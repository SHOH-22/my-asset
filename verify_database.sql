-- 가계부 대차평균 원리(차변 합계 = 대변 합계) 및 무결성 검증 쿼리

-- 1. 트랜잭션 내에서 차변(양수)과 대변(음수)의 합이 0이 되지 않는 트랜잭션 찾기
-- 이 쿼리의 결과가 0건이어야 모든 분개가 정상적으로 처리된 것입니다.
SELECT 
    t.id AS transaction_id,
    t.transaction_date,
    t.description,
    SUM(je.amount) AS total_sum
FROM transactions t
JOIN journal_entries je ON t.id = je.transaction_id
GROUP BY t.id, t.transaction_date, t.description
HAVING SUM(je.amount) != 0;

-- 2. 외톨이 분개 (연결된 트랜잭션이 없는 분개 내역) 찾기
-- 이 쿼리의 결과도 0건이어야 합니다.
SELECT je.*
FROM journal_entries je
LEFT JOIN transactions t ON je.transaction_id = t.id
WHERE t.id IS NULL;

-- 3. 고아 트랜잭션 (연결된 분개 내역이 0개인 껍데기 트랜잭션) 찾기
-- 이 쿼리의 결과도 0건이어야 합니다.
SELECT t.*
FROM transactions t
LEFT JOIN journal_entries je ON t.id = je.transaction_id
WHERE je.id IS NULL;
