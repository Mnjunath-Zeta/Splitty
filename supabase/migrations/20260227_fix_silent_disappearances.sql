-- Fix for Activity Log Triggers and Schema Issues
-- 1. Add missing 'is_settlement' column to expenses
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS is_settlement BOOLEAN DEFAULT FALSE;

-- 2. Update log_expense_activity to safely check profiles and handle settlements
CREATE OR REPLACE FUNCTION public.log_expense_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
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
BEGIN
    -- Determine Actor
    actor_id := auth.uid();
    IF actor_id IS NULL THEN actor_id := NEW.created_by; END IF;

    -- Get Actor Name
    SELECT coalesce(full_name, email, 'Someone') INTO actor_name
    FROM public.profiles
    WHERE id = actor_id;

    -- Get Group Name if exists
    IF NEW.group_id IS NOT NULL THEN
        SELECT name INTO group_name FROM public.groups WHERE id = NEW.group_id;
    END IF;

    -- Resolve Participant Names
    split_with_array := NEW.split_with;
    IF split_with_array IS NOT NULL THEN
       SELECT array_agg(coalesce(full_name, 'Unknown'))
       INTO participant_names
       FROM public.profiles
       WHERE id IN (
           SELECT value::uuid 
           FROM jsonb_array_elements_text(split_with_array) 
           WHERE value ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
       );
    END IF;

    -- Resolve Payer Name from Profile
    IF NEW.payer_id IS NOT NULL THEN
        SELECT coalesce(full_name, email, 'Someone') INTO resolved_payer_name FROM public.profiles WHERE id = NEW.payer_id;
    END IF;
    IF resolved_payer_name IS NULL OR resolved_payer_name = 'Someone' THEN
        resolved_payer_name := NEW.payer_name;
    END IF;

    -- Build Metadata
    metadata_json := jsonb_build_object(
        'amount', NEW.amount,
        'currency', 'USD',
        'payer_name', resolved_payer_name,
        'group_name', group_name,
        'split_type', NEW.split_type,
        'participants', participant_names
    );

    IF TG_OP = 'INSERT' THEN
        -- Action Text Logic for Settlements vs Expenses
        IF NEW.is_settlement = TRUE THEN
            action_text := 'You settled up';
            participant_action_text := actor_name || ' settled up with you';
        ELSE
            action_text := 'You added ''' || NEW.description || '''';
            participant_action_text := actor_name || ' added you to ''' || NEW.description || '''';
        END IF;

        -- 1. Log for the Creator
        INSERT INTO public.activity_logs (user_id, actor_id, entity_type, entity_id, action, description, metadata)
        VALUES (actor_id, actor_id, 'expense', NEW.id, 'created', action_text, metadata_json);

        -- 2. Log for Participants
        IF split_with_array IS NOT NULL THEN
            FOR participant_id IN SELECT * FROM jsonb_array_elements_text(split_with_array)
            LOOP
                IF participant_id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
                    recipient_id := participant_id::uuid;
                    
                    -- CRITICAL BUG FIX: Ensure the recipient_id actually exists in the 'profiles' table 
                    -- before inserting into activity_logs, which prevents Foreign Key constraint violations.
                    IF recipient_id <> actor_id AND EXISTS(SELECT 1 FROM public.profiles WHERE id = recipient_id) THEN
                        INSERT INTO public.activity_logs (user_id, actor_id, entity_type, entity_id, action, description, metadata)
                        VALUES (recipient_id, actor_id, 'expense', NEW.id, 'created', participant_action_text, metadata_json);
                    END IF;
                END IF;
            END LOOP;
        END IF;
        
    ELSIF TG_OP = 'UPDATE' THEN
        IF NEW.created_by <> actor_id AND EXISTS(SELECT 1 FROM public.profiles WHERE id = NEW.created_by) THEN
             INSERT INTO public.activity_logs (user_id, actor_id, entity_type, entity_id, action, description, metadata)
             VALUES (NEW.created_by, actor_id, 'expense', NEW.id, 'updated', actor_name || ' updated ''' || NEW.description || '''', metadata_json);
        END IF;
    END IF;

    -- For AFTER triggers, returning NEW is safe and prevents silent insert blocks
    RETURN NEW;
END;
$$;

-- Ensure the trigger is attached properly
DROP TRIGGER IF EXISTS on_expense_activity ON public.expenses;
CREATE TRIGGER on_expense_activity
    AFTER INSERT OR UPDATE
    ON public.expenses
    FOR EACH ROW
    EXECUTE FUNCTION public.log_expense_activity();
