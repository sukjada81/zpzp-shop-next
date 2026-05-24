-- 004_order_tables_utf8mb4.sql
-- Fix order creation/log failing with MariaDB error 3988 when buyer name/memo
-- (or product name) contains emoji / 4-byte chars, because order tables were utf8mb3.
-- Applied manually on prod 2026-05-24. Safe widening; tables small, ROW_FORMAT=Dynamic.
-- Note: dad_order_action_log was already utf8mb4 (skipped).

ALTER TABLE mallRN_order_info  CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE mallRN_order_goods CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE mallRN_order_log   CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
