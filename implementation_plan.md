# 가계부 프로젝트 (MyAsset) 구현 계획

복식부기 가계부의 상세 요구사항을 반영하여, 10인 이내의 그룹이 각자의 자산을 모바일 및 PC에서 독립적으로 관리하면서 필요시 공유할 수 있는 시스템을 구축합니다.

## User Review Required
> [!IMPORTANT]
> **데이터베이스(Supabase) 설정**
> 빠른 테스트와 원활한 실시간 데이터 관리를 위해 `Supabase`를 사용할 예정입니다. 우선 제가 로컬 Supabase의 형태나, Next.js 프로젝트 내에 더미 데이터를 주입하는 방식으로 기본 뷰를 만들어볼 수 있고, 아니면 가입하신 Supabase 클라우드 계정에 프로젝트를 만들어 배포할 수 있습니다. 로컬/더미로 먼저 화면을 확인하시겠습니까?

> [!NOTE]
> **공유 및 조회 권한 설계**
> "공유가 허용된 계정끼리는 현황 같이 보기 허용" 조건을 만족시키기 위해 데이터베이스의 `Row Level Security (RLS)` 기능을 적극 활용합니다. 사용자(User)는 자신만의 독립적인 계정(Account)을 만들 수 있으며, 특정 타 사용자에게 읽기 권한을 주도록 설계할 것입니다.

## Proposed Changes

### 1. Database Schema
Supabase Postgres 기반

#### [NEW] Core System
- `users / profiles` : 인적 사항 및 그룹 매핑 기반 시스템
- `accounts` : 자산, 부채, 자본, 비용, 수익 분류 (공유 권한 필드 포함)
- `transactions` : 거래 마스터 테이블 (거래일시, 요약 설명 등)
- `journal_entries` (분개장) : 1개 트랜잭션 종속, 차변(Debit)/대변(Credit) 금액, 해당 계정(account_id) 저장

#### [NEW] Additional Features
- `fixed_transactions_templates` : 고정 지출 정보 저장 본(템플릿)
- `auto_transfers` : 자동이체 기록부
- `insurance_policies` : 보유 보험 리스트 마스터 관리
- `budgets` : 특정 계정/카테고리 별 월간, 연간 예산

### 2. Frontend Application (Next.js)

#### [NEW] `c:/Users/shoh2/MyProject/MyAsset/`
이 프레임워크 안에 모바일 최적화를 반영한 `shadcn/ui` UI 컴포넌트를 사용해 반응형 대시보드를 구축합니다.

- **대시보드 페이지 (Home)**: 나의 전체 자산 현황, 최근 수입/지출 내역
- **가계부 입력 폼 (Input)**: 복식부기 원리를 사용자가 친숙하게 느끼도록 (출금계좌 -> 입금계좌 형태로 선택 시 자동 차대변 매핑) 구성
- **리포트 (Reports)**: 지정 기간 및 시점별 손익계산서/대차대조표 제공
- **부가 기능 메뉴**: 자동이체 목록, 보험 목록 관리

## Verification Plan

### Automated Tests
- 분개장(Journal Entries) 생성 시 차변 합 = 대변 합 일치를 검증하기 위한 Database Trigger / Backend API 로직 검증

### Manual Verification
- 작성한 가계부의 합산 값이 대차대조표 리포트 결과와 일치하는 지 직접 확인
- 모바일 크기로 브라우저 조절 시 UI 깨짐이 없고 입력이 용이한 지 검수
