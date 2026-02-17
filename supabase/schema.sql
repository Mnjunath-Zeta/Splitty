-- Create a table for public profiles
create table profiles (
  id uuid references auth.users on delete cascade not null primary key,
  updated_at timestamp with time zone,
  email text unique,
  full_name text,
  avatar_url text,
  phone text,

  constraint username_length check (char_length(full_name) >= 3)
);
-- Set up Row Level Security (RLS)
-- See https://supabase.com/docs/guides/auth/row-level-security for more details.
alter table profiles enable row level security;

create policy "Public profiles are viewable by everyone." on profiles
  for select using (true);

create policy "Users can insert their own profile." on profiles
  for insert with check (auth.uid() = id);

create policy "Users can update own profile." on profiles
  for update using (auth.uid() = id);

-- This triggers a function every time a new user signs up
-- ensuring their profile is created automatically.
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id, 
    new.email, 
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'), 
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Create Groups Table
create table groups (
    id uuid default gen_random_uuid() primary key,
    name text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    created_by uuid references profiles(id) not null
);

alter table groups enable row level security;

-- Create Group Members Table (Many-to-Many)
create table group_members (
    group_id uuid references groups(id) on delete cascade not null,
    user_id uuid references profiles(id) on delete cascade not null,
    joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
    primary key (group_id, user_id)
);

alter table group_members enable row level security;

-- Create Expenses Table
create table expenses (
    id uuid default gen_random_uuid() primary key,
    description text not null,
    amount numeric not null,
    payer_id uuid references profiles(id), -- Nullable for local friends
    payer_name text, -- Name of local payer if payer_id is null
    group_id uuid references groups(id), -- Nullable for personal expenses
    date timestamp with time zone default timezone('utc'::text, now()) not null,
    category text default 'general',
    split_type text default 'equal',
    split_details jsonb default '{}'::jsonb,
    split_with jsonb default '[]'::jsonb,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    created_by uuid references profiles(id) not null
);

alter table expenses enable row level security;

-- Expense Participants (Many-to-Many logic handled via jsonb in 'split_details' or separate table? 
-- For strict integrity, separate table is better, but JSONB is flexible for MVP. Let's stick with JSONB or array for participants for now.)
-- Actually, let's keep it simple.

-- Helper Function to break RLS recursion
create or replace function public.is_group_member(gid uuid, uid uuid)
returns boolean as $$
begin
  return exists (
    select 1 from public.group_members 
    where group_id = gid and user_id = uid
  );
end;
$$ language plpgsql security definer;

-- Policies for Groups
create policy "Groups are viewable by members." on groups
  for select using (is_group_member(id, auth.uid()));

create policy "Users can create groups." on groups
  for insert with check (auth.uid() = created_by);

create policy "Users can update their groups." on groups
  for update using (auth.uid() = created_by);

create policy "Users can delete their groups." on groups
  for delete using (auth.uid() = created_by);

-- Policies for Group Members
create policy "Members are viewable by group members." on group_members
  for select using (is_group_member(group_id, auth.uid()));
  
create policy "Users can join groups." on group_members
  for insert with check (auth.uid() = user_id);

create policy "Users can leave groups." on group_members
  for delete using (auth.uid() = user_id);

-- Policies for Expenses
create policy "Expenses are viewable by participants." on expenses
  for select using (
    auth.uid() = created_by or 
    auth.uid() = payer_id or
    (group_id is not null and is_group_member(group_id, auth.uid()))
  );

create policy "Users can create expenses." on expenses
  for insert with check (auth.uid() = created_by);

create policy "Users can update their expenses." on expenses
  for update using (auth.uid() = created_by);

create policy "Users can delete their expenses." on expenses
  for delete using (auth.uid() = created_by);

-- Create Friends Table
create table friends (
    id uuid default gen_random_uuid() primary key,
    name text not null,
    user_id uuid references profiles(id) on delete cascade not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table friends enable row level security;

create policy "Users can view their own friends." on friends
    for select using (auth.uid() = user_id);

create policy "Users can add their own friends." on friends
    for insert with check (auth.uid() = user_id);

create policy "Users can delete their own friends." on friends
    for delete using (auth.uid() = user_id);

-- Enable Real-time for all tables
alter publication supabase_realtime add table expenses;
alter publication supabase_realtime add table friends;
alter publication supabase_realtime add table groups;

-- Set replica identity to FULL for better deletion handling
alter table expenses replica identity full;
alter table friends replica identity full;
alter table groups replica identity full;
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
