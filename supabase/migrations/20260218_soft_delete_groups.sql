-- Soft delete for groups: instead of deleting a group row, we track which users
-- have archived (hidden) it. Other members continue to see the group normally.
ALTER TABLE groups ADD COLUMN IF NOT EXISTS archived_by uuid[] DEFAULT '{}';
