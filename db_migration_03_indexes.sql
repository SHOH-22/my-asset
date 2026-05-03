-- ========================================================
-- 가계부 고도화: 조회 성능 및 확장성 향상을 위한 인덱스 마이그레이션
-- ========================================================

-- 1. Accounts (계정과목) 인덱스
-- owner_id를 조건으로 하는 계정 조회 쿼리 성능 최적화
create index if not exists idx_accounts_owner_id on public.accounts(owner_id);
-- 부모/자식 계정 조회를 위한 인덱스
create index if not exists idx_accounts_parent_id on public.accounts(parent_account_id);

-- 2. Transactions (거래 마스터) 인덱스
-- creator_id 단일 조건 조회 성능 최적화
create index if not exists idx_transactions_creator_id on public.transactions(creator_id);
-- 복합 인덱스: 대시보드에서 '본인의 거래를 기간별로 최신순 조회'할 때 가장 많이 사용됨
create index if not exists idx_transactions_creator_date on public.transactions(creator_id, transaction_date DESC);
-- 분류별 조회를 위한 인덱스
create index if not exists idx_transactions_classification_id on public.transactions(classification_id);

-- 3. Journal Entries (분개장 내역) 인덱스
-- transaction_id를 조건으로 분개 내역을 조인할 때 필수
create index if not exists idx_journal_entries_tx_id on public.journal_entries(transaction_id);
-- 특정 계정(account_id)의 잔액이나 거래 내역을 집계할 때 필수
create index if not exists idx_journal_entries_account_id on public.journal_entries(account_id);

-- 4. Budgets (예산 설정) 인덱스
create index if not exists idx_budgets_owner_id on public.budgets(owner_id);

-- 5. Auto Transfers (자동이체 현황 관리) 인덱스
create index if not exists idx_auto_transfers_owner_id on public.auto_transfers(owner_id);
create index if not exists idx_auto_transfers_withdrawal_acc on public.auto_transfers(withdrawal_account_id);
create index if not exists idx_auto_transfers_deposit_acc on public.auto_transfers(deposit_account_id);

-- 6. Insurance Policies (보험 가입 현황) 인덱스
create index if not exists idx_insurance_policies_owner_id on public.insurance_policies(owner_id);

-- 7. Transaction Classifications (거래 분류) 인덱스
create index if not exists idx_tx_class_owner_id on public.transaction_classifications(owner_id);

-- 8. Frequent Transactions (자주 쓰는 거래내역) 인덱스
create index if not exists idx_freq_tx_owner_id on public.frequent_transactions(owner_id);
