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
    payer_id uuid references profiles(id) not null,
    group_id uuid references groups(id), -- Nullable for personal expenses
    date timestamp with time zone default timezone('utc'::text, now()) not null,
    category text default 'general',
    split_type text default 'equal',
    split_details jsonb default '{}'::jsonb,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    created_by uuid references profiles(id) not null
);

alter table expenses enable row level security;

-- Expense Participants (Many-to-Many logic handled via jsonb in 'split_details' or separate table? 
-- For strict integrity, separate table is better, but JSONB is flexible for MVP. Let's stick with JSONB or array for participants for now.)
-- Actually, let's keep it simple.

-- Policies for Groups
create policy "Groups are viewable by members." on groups
  for select using (
    auth.uid() in (
      select user_id from group_members where group_id = id
    )
  );

create policy "Users can create groups." on groups
  for insert with check (auth.uid() = created_by);

-- Policies for Group Members
create policy "Members are viewable by group members." on group_members
  for select using (
    exists (
      select 1 from group_members gm 
      where gm.group_id = group_members.group_id 
      and gm.user_id = auth.uid()
    )
  );
  
 create policy "Users can join groups." on group_members
  for insert with check (auth.uid() = user_id); -- Only self-join for now? Or invite logic later.

-- Policies for Expenses
create policy "Expenses provided by user or in user's groups are viewable." on expenses
  for select using (
    auth.uid() = created_by or 
    auth.uid() = payer_id or
    (group_id is not null and exists (
      select 1 from group_members gm 
      where gm.group_id = expenses.group_id 
      and gm.user_id = auth.uid()
    ))
  );

create policy "Users can create expenses." on expenses
  for insert with check (auth.uid() = created_by);
