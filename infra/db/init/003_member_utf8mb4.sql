-- 003_member_utf8mb4.sql
-- Fix Kakao login member.create failing with MariaDB error 3988
-- (emoji / 4-byte chars in display name) because mallRN_member columns were utf8mb3.
-- Applied manually on prod 2026-05-24 via DBA connection.
-- Safe widening (utf8mb3 is a subset of utf8mb4); ROW_FORMAT=Dynamic so index key lengths are fine.

ALTER TABLE mallRN_member CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
