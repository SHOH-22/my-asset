-- ========================================================
-- 가계부 고도화: 거래분류 및 자주쓰는 거래내역 (템플릿) 마이그레이션
-- ========================================================

-- 1. 거래분류(Transaction Classifications) 테이블 생성
create table public.transaction_classifications (
  id uuid default uuid_generate_v4() primary key,
  owner_id uuid references public.profiles(id) on delete cascade not null,
  name text not null, -- 예: '일반', '고정'
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Transactions 테이블에 거래분류 ID 추가
alter table public.transactions add column classification_id uuid references public.transaction_classifications(id) on delete set null;

-- 3. 자주쓰는 거래내역(Frequent Transactions) 테이블 생성
create table public.frequent_transactions (
  id uuid default uuid_generate_v4() primary key,
  owner_id uuid references public.profiles(id) on delete cascade not null,
  type text not null, -- 'expense', 'income', 'transfer'
  amount numeric,
  description text,
  from_account_id uuid references public.accounts(id) on delete set null,
  to_account_id uuid references public.accounts(id) on delete set null,
  classification_id uuid references public.transaction_classifications(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ========================================================
-- RLS (Row Level Security) 활성화 및 권한 설정
-- ========================================================

alter table public.transaction_classifications enable row level security;
alter table public.frequent_transactions enable row level security;

-- 본인 소유의 데이터만 조회/수정/삭제 가능하도록 정책 생성
create policy "본인 거래분류만 관리 가능" on public.transaction_classifications for all using ( auth.uid() = owner_id );
create policy "본인 자주쓰는 거래내역만 관리 가능" on public.frequent_transactions for all using ( auth.uid() = owner_id );
