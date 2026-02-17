-- Add split_with column to expenses table to store participant IDs
ALTER TABLE expenses
ADD COLUMN split_with jsonb DEFAULT '[]'::jsonb;
