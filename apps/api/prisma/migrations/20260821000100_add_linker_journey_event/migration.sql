-- 링커 여정 이벤트 로그 (visit / attributed / order_created)
-- 운영 DB에 테이블이 먼저 반영된 환경에서도 재실행할 수 있도록 IF NOT EXISTS 사용.

CREATE TABLE IF NOT EXISTS `zpzp_linker_journey_event` (
  `uid` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `event_type` ENUM('visit', 'attributed', 'order_created') NOT NULL,
  `linker_id` INT NULL,
  `landing_slug` VARCHAR(64) NULL,
  `member_uid` INT UNSIGNED NULL,
  `order_num` VARCHAR(50) NULL,
  `checkout_shop_slug` VARCHAR(64) NULL,
  `session_key` VARCHAR(64) NULL,
  `meta_json` VARCHAR(1000) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`uid`),
  KEY `ix_zpzp_lje_linker_created` (`linker_id`, `created_at`),
  KEY `ix_zpzp_lje_slug_type_created` (`landing_slug`, `event_type`, `created_at`),
  KEY `ix_zpzp_lje_member_created` (`member_uid`, `created_at`),
  KEY `ix_zpzp_lje_order` (`order_num`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
