-- Function to handle bidirectional friend deletion
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

-- Trigger to run after a friend is deleted
drop trigger if exists on_friend_deleted on public.friends;
create trigger on_friend_deleted
  after delete on public.friends
  for each row execute procedure public.handle_delete_friend();
