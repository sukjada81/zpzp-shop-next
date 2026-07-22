-- 1: 가장 최근 확정 등급 유지
-- 2: 현재 월 등급 우선, 없으면 마지막 달 base_amount로 활성 등급 정책 재산정
INSERT INTO `zpzp_setting` (`name`, `value`)
VALUES ('linker_grade_lookup_type', '1')
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);
