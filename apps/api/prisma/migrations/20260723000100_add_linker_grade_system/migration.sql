-- 코드경로: apps/api/prisma/migrations/20260723000100_add_linker_grade_system/migration.sql
-- 구매회원 매출등급(mallRN_member_grade*)과 분리된 링커 전용 등급 시스템
-- 운영 DB에 테이블이 먼저 반영된 환경에서도 재실행할 수 있도록 IF NOT EXISTS를 사용한다.

CREATE TABLE IF NOT EXISTS `zpzp_linker_grade_policy` (
  `uid` INT NOT NULL AUTO_INCREMENT,
  `grade_code` VARCHAR(30) NOT NULL,
  `title` VARCHAR(50) NOT NULL DEFAULT '',
  `crew_min` INT NOT NULL DEFAULT 0 COMMENT '승급 기준 누적 크루 수(매출 아님)',
  `commission_rate` DECIMAL(5,2) NOT NULL DEFAULT 0.00 COMMENT '등급 요율 %',
  `slot_count` INT NOT NULL DEFAULT 0 COMMENT '진열 슬롯 수',
  `sort` TINYINT NOT NULL DEFAULT 0,
  `is_active` TINYINT NOT NULL DEFAULT 1,
  `note` VARCHAR(255) NULL,
  `created_at` INT UNSIGNED NOT NULL DEFAULT 0,
  `updated_at` INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (`uid`),
  UNIQUE KEY `uq_grade_code` (`grade_code`),
  KEY `idx_active_crewmin` (`is_active`, `crew_min`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `zpzp_linker_grade` (
  `uid` BIGINT NOT NULL AUTO_INCREMENT,
  `linker_id` INT NOT NULL,
  `year_month` CHAR(7) NOT NULL COMMENT '반영월 YYYY-MM',
  `cutoff_at` DATETIME NULL COMMENT '산정 마감선',
  `crew_count` INT NOT NULL DEFAULT 0,
  `grade_code` VARCHAR(30) NOT NULL DEFAULT '',
  `commission_rate` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `slot_count` INT NOT NULL DEFAULT 0,
  `effective_from` DATETIME NOT NULL COMMENT '발효 시각(정산 시점조회 기준)',
  `decided_by` VARCHAR(32) NOT NULL DEFAULT 'system',
  `created_at` DATETIME NOT NULL,
  PRIMARY KEY (`uid`),
  UNIQUE KEY `uq_linker_month` (`linker_id`, `year_month`),
  KEY `ix_linker_eff` (`linker_id`, `effective_from`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `zpzp_linker_grade_history` (
  `uid` BIGINT NOT NULL AUTO_INCREMENT,
  `linker_id` INT NOT NULL,
  `before_grade` VARCHAR(30) NULL,
  `after_grade` VARCHAR(30) NULL,
  `before_rate` DECIMAL(5,2) NULL,
  `after_rate` DECIMAL(5,2) NULL,
  `reason` ENUM('auto','manual','initial') NOT NULL,
  `crew_count_at` INT NOT NULL DEFAULT 0,
  `actor` VARCHAR(32) NOT NULL DEFAULT 'system',
  `year_month` CHAR(7) NOT NULL DEFAULT '',
  `note` VARCHAR(255) NULL,
  `created_at` DATETIME NOT NULL,
  PRIMARY KEY (`uid`),
  KEY `ix_hist_linker` (`linker_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 이미 운영자가 수정한 정책값은 덮어쓰지 않고, 없는 등급만 기본값으로 추가한다.
INSERT IGNORE INTO `zpzp_linker_grade_policy`
  (`grade_code`, `title`, `crew_min`, `commission_rate`, `slot_count`, `sort`, `is_active`, `created_at`, `updated_at`)
VALUES
  ('rookie',  '루키',   0,    5.00, 10, 1, 1, UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
  ('rising',  '라이징', 10,   5.00, 20, 2, 1, UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
  ('ace',     '에이스', 200,  6.00, 30, 3, 1, UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
  ('master',  '마스터', 600,  7.00, 40, 4, 1, UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
  ('diamond', '다이아', 1500, 7.50, 50, 5, 1, UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
  ('legend',  '레전드', 3000, 8.00, 50, 6, 1, UNIX_TIMESTAMP(), UNIX_TIMESTAMP());
