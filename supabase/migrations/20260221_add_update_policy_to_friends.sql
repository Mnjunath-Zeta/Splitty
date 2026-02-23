-- Add UPDATE policy for friends table
-- Allows users to update their own friend records

CREATE POLICY "Users can update their own friends"
  ON friends
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
