-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Profiles Table (Supabase Auth 연동)
create table public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  full_name text,
  family_group_id uuid, -- 가족 공유 기능을 대비한 그룹 ID
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Accounts (계정과목: 자산, 부채, 자본, 비용, 수익 등)
create table public.accounts (
  id uuid default uuid_generate_v4() primary key,
  owner_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,               -- 예: 국민은행 급여통장, 식비, 수입
  type text not null,               -- 'asset', 'liability', 'equity', 'revenue', 'expense'
  group_type text,                  -- 대분류 (트리 구조 1단계)
  sub_category text,                -- 중분류 (트리 구조 2단계)
  parent_account_id uuid references public.accounts(id), -- 하위 계정 연결을 위한 참조
  is_shared boolean default false,  -- 가족 공유 허용 여부
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Transactions (거래 마스터)
create table public.transactions (
  id uuid default uuid_generate_v4() primary key,
  creator_id uuid references public.profiles(id) on delete cascade not null,
  transaction_date date not null,
  description text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Journal Entries (분개장 내역)
create table public.journal_entries (
  id uuid default uuid_generate_v4() primary key,
  transaction_id uuid references public.transactions(id) on delete cascade not null,
  account_id uuid references public.accounts(id) on delete restrict not null,
  amount numeric not null, -- 내부 규칙: 차변(양수), 대변(음수) 등
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. Auto Transfers (자동이체 현황 관리)
create table public.auto_transfers (
  id uuid default uuid_generate_v4() primary key,
  owner_id uuid references public.profiles(id) on delete cascade not null,
  withdrawal_account_id uuid references public.accounts(id),
  deposit_account_id uuid references public.accounts(id),
  amount numeric not null,
  transfer_day_of_month integer not null,
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 6. Insurance Policies (보험 가입 현황)
create table public.insurance_policies (
  id uuid default uuid_generate_v4() primary key,
  owner_id uuid references public.profiles(id) on delete cascade not null,
  policy_name text not null,
  provider text not null,
  contractor_name text not null,
  monthly_premium numeric not null,
  contract_date date,
  coverage_period text,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 7. Budgets (예산 설정)
create table public.budgets (
  id uuid default uuid_generate_v4() primary key,
  owner_id uuid references public.profiles(id) on delete cascade not null,
  category_name text not null, -- 예: '식비', '교통비' (중분류/대분류 이름)
  target_month text not null,  -- 'DEFAULT' 또는 'YYYY-MM'
  amount numeric not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (owner_id, category_name, target_month)
);

-- === 안전을 위한 데이터 격리 기능 활성화 (RLS) ===
alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.transactions enable row level security;
alter table public.journal_entries enable row level security;
alter table public.budgets enable row level security;

-- 누구나 읽거나 쓸 수 없게 차단하되, 로그인한 본인 데이터만 CRUD 하도록 구성 예시
create policy "자신의 프로필만 열람 가능" on public.profiles for select using ( auth.uid() = id );
create policy "자신의 계정만 관리 가능" on public.accounts for all using ( auth.uid() = owner_id );
create policy "본인 거래 기록만 열람/수정 가능" on public.transactions for all using ( auth.uid() = creator_id );
create policy "본인 예산만 접근 가능" on public.budgets for all using ( auth.uid() = owner_id );
