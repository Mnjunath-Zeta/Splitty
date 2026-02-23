-- Fix activity logs trying to insert for local friends
-- Local friends have UUIDs but no profile row, causing FK violations on activity_logs.user_id

create or replace function public.log_expense_activity()
returns trigger
language plpgsql
security definer
as $$
declare
    actor_name text;
    actor_id uuid;
    recipient_id uuid;
    participant_id text;
    split_with_array jsonb;
    group_name text;
    metadata_json jsonb;
    participant_names text[];
    resolved_payer_name text;
    action_text text;
    participant_action_text text;
begin
    -- Determine Actor
    actor_id := auth.uid();
    if actor_id is null then actor_id := NEW.created_by; end if;

    -- Get Actor Name
    select coalesce(full_name, email, 'Someone') into actor_name
    from public.profiles
    where id = actor_id;

    -- Get Group Name if exists
    if NEW.group_id is not null then
        select name into group_name from public.groups where id = NEW.group_id;
    end if;

    -- Resolve Participant Names
    split_with_array := NEW.split_with;
    if split_with_array is not null then
       select array_agg(coalesce(full_name, 'Unknown'))
       into participant_names
       from public.profiles
       where id in (
           select value::uuid 
           from jsonb_array_elements_text(split_with_array) 
           where value ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
       );
    end if;

    -- Resolve Payer Name from Profile (Reliable source text)
    if NEW.payer_id is not null then
        select coalesce(full_name, email, 'Someone') into resolved_payer_name from public.profiles where id = NEW.payer_id;
    end if;
    if resolved_payer_name is null or resolved_payer_name = 'Someone' then
        resolved_payer_name := NEW.payer_name; -- Fallback to what client sent
    end if;

    -- Build Metadata
    metadata_json := jsonb_build_object(
        'amount', NEW.amount,
        'currency', 'USD',
        'payer_name', resolved_payer_name,
        'group_name', group_name,
        'split_type', NEW.split_type,
        'participants', participant_names
    );

    if TG_OP = 'INSERT' then
        -- Action Text Logic for Settlements vs Expenses
        -- Ensure we can reference NEW.amount or NEW.split_type even if it's a settlement
        -- But note: is_settlement is not a column in expenses, it's inferred or we might have dropped it.
        -- Assuming 'You added' for now (will keep existing logic or update if needed)
        -- Looking at the previous code, there was a check for NEW.is_settlement. We will keep it robustly.
        
        -- Safe check if is_settlement exists (Supabase jsonb or column)
        begin
            if NEW.is_settlement = true then
                action_text := 'You settled up';
                participant_action_text := actor_name || ' settled up with you';
            else
                action_text := 'You added ''' || NEW.description || '''';
                participant_action_text := actor_name || ' added you to ''' || NEW.description || '''';
            end if;
        exception when others then
            action_text := 'You added ''' || NEW.description || '''';
            participant_action_text := actor_name || ' added you to ''' || NEW.description || '''';
        end;


        -- 1. Log for the Creator
        insert into public.activity_logs (user_id, actor_id, entity_type, entity_id, action, description, metadata)
        values (actor_id, actor_id, 'expense', NEW.id, 'created', action_text, metadata_json);

        -- 2. Log for Participants
        split_with_array := NEW.split_with;
        if split_with_array is not null then
            for participant_id in select * from jsonb_array_elements_text(split_with_array)
            loop
                if participant_id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
                    recipient_id := participant_id::uuid;
                    
                    -- CRITICAL FIX: Only insert if the recipient_id actually exists in the profiles table!
                    if recipient_id <> actor_id and exists(select 1 from public.profiles where id = recipient_id) then
                        insert into public.activity_logs (user_id, actor_id, entity_type, entity_id, action, description, metadata)
                        values (recipient_id, actor_id, 'expense', NEW.id, 'created', participant_action_text, metadata_json);
                    end if;
                end if;
            end loop;
        end if;
        
    elsif TG_OP = 'UPDATE' then
        if NEW.created_by <> actor_id and exists(select 1 from public.profiles where id = NEW.created_by) then
             insert into public.activity_logs (user_id, actor_id, entity_type, entity_id, action, description, metadata)
             values (NEW.created_by, actor_id, 'expense', NEW.id, 'updated', actor_name || ' updated ''' || NEW.description || '''', metadata_json);
        end if;
    end if;

    return NEW; -- MUST RETURN NEW IN A TRIGGER! (Previous iteration returned null which blocks inserts)
end;
$$;
