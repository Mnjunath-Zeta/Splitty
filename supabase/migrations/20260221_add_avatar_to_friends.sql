-- Add avatar_url column to friends table
-- This allows users to set custom avatars for their local friends.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'friends' AND column_name = 'avatar_url') THEN
        ALTER TABLE public.friends ADD COLUMN avatar_url TEXT;
    END IF;
END $$;
