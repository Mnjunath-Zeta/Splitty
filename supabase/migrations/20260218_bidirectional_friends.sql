-- Function to handle bidirectional friendship
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

-- Trigger to run after a friend is inserted
drop trigger if exists on_friend_added on public.friends;
create trigger on_friend_added
  after insert on public.friends
  for each row execute procedure public.handle_new_friend();
