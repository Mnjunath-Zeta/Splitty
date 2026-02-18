-- 1. Function to handle bidirectional friendship (Creation)
create or replace function public.handle_new_friend()
returns trigger as $$
declare
  initiator_profile record;
  reverse_exists boolean;
begin
  -- Only proceed if the new friend is linked to a real user
  if new.linked_user_id is not null then
    
    -- Check if a reverse friendship already exists
    select exists(
      select 1 from public.friends 
      where user_id = new.linked_user_id and linked_user_id = new.user_id
    ) into reverse_exists;

    if not reverse_exists then
      -- Get the initiator's profile to use as the name for the friend record
      select full_name into initiator_profile from public.profiles where id = new.user_id;
      
      -- Insert the reverse friend record
      -- user_id = the linked user (User B)
      -- linked_user_id = the initiator (User A)
      -- name = initiator's name
      insert into public.friends (id, user_id, linked_user_id, name)
      values (
        gen_random_uuid(),
        new.linked_user_id,
        new.user_id,
        coalesce(initiator_profile.full_name, 'Friend') -- Fallback if name is missing
      );
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;

-- 2. Trigger for friend creation
drop trigger if exists on_friend_added on public.friends;
create trigger on_friend_added
  after insert on public.friends
  for each row execute procedure public.handle_new_friend();


-- 3. Function to handle bidirectional friend deletion
create or replace function public.handle_delete_friend()
returns trigger as $$
begin
  -- Only proceed if the deleted friend was linked to a real user
  if old.linked_user_id is not null then
    
    -- Delete the reverse friend record
    -- We want to delete the row where:
    -- user_id = the deleted friend's linked_user_id (User B)
    -- linked_user_id = the user who initiated the delete (User A)
    delete from public.friends
    where user_id = old.linked_user_id 
    and linked_user_id = old.user_id;
    
  end if;
  return old;
end;
$$ language plpgsql security definer;

-- 4. Trigger for friend deletion
drop trigger if exists on_friend_deleted on public.friends;
create trigger on_friend_deleted
  after delete on public.friends
  for each row execute procedure public.handle_delete_friend();
