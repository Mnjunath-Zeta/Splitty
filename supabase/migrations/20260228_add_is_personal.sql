-- Add 'is_personal' flag to expenses for standalone spends
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS is_personal BOOLEAN DEFAULT FALSE;
