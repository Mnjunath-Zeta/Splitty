-- Create a function to look up user by email or phone
-- This is necessary because RLS typically hides other users' profiles from normal queries.
CREATE OR REPLACE FUNCTION public.lookup_user_by_email(search_email text)
RETURNS jsonb AS $$
DECLARE
  found_user RECORD;
BEGIN
  SELECT id, full_name, avatar_url, email
  INTO found_user
  FROM profiles
  WHERE email = search_email
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'id', found_user.id,
      'full_name', found_user.full_name,
      'avatar_url', found_user.avatar_url,
      'email', found_user.email
    );
  ELSE
    RETURN NULL;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create helper function for phone lookup
CREATE OR REPLACE FUNCTION public.lookup_user_by_phone(search_phone text)
RETURNS jsonb AS $$
DECLARE
  found_user RECORD;
BEGIN
  SELECT id, full_name, avatar_url, phone
  INTO found_user
  FROM profiles
  WHERE phone = search_phone
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'id', found_user.id,
      'full_name', found_user.full_name,
      'avatar_url', found_user.avatar_url,
      'phone', found_user.phone
    );
  ELSE
    RETURN NULL;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update RLS for expenses to allow 'split_with' users to see them
-- We must drop the existing policy first if we want to replace it, or create a new one.
-- Assuming "Expenses are viewable by participants." is the name.
DROP POLICY IF EXISTS "Expenses are viewable by participants." ON expenses;

CREATE POLICY "Expenses are viewable by participants." ON expenses
  FOR SELECT USING (
    auth.uid() = created_by OR 
    auth.uid() = payer_id OR
    (group_id IS NOT NULL AND is_group_member(group_id, auth.uid())) OR
    split_with @> jsonb_build_array(auth.uid())
  );

-- Update friends table to support linking to real users
ALTER TABLE friends ADD COLUMN IF NOT EXISTS linked_user_id uuid REFERENCES profiles(id);
