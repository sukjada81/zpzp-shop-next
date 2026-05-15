-- 003_order_log.sql
-- 주문 액션 로그 테이블 (dad_order_action_log)
--  - 취소(cancel), 픽업확인(pickup_confirm) 등 분쟁 가능성 있는 액션의 행위자/시점 기록용
--  - 누적 히스토리. 같은 주문에 다회 기록 가능
--  - 기존 mallRN_order_log(상태변경 단순로그)와 별도. 이건 분쟁 추적용으로 닉네임/역할/사유까지 보존
--
-- 멱등성: CREATE TABLE IF NOT EXISTS 사용

CREATE TABLE IF NOT EXISTS `dad_order_action_log` (
    `uid` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `tenant_id` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `event_type` VARCHAR(32) NOT NULL,
    `order_num` VARCHAR(32) NOT NULL DEFAULT '',
    `order_goods_uid` INT UNSIGNED NULL,
    `actor_role` VARCHAR(20) NOT NULL DEFAULT '',
    `actor_member_uid` BIGINT UNSIGNED NULL,
    `actor_nickname` VARCHAR(100) NOT NULL DEFAULT '',
    `before_status` TINYINT UNSIGNED NULL,
    `after_status` TINYINT UNSIGNED NULL,
    `reason` VARCHAR(255) NULL,
    `meta_json` TEXT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`uid`),
    KEY `idx_dad_order_action_log_order_num` (`order_num`),
    KEY `idx_dad_order_action_log_tenant_event` (`tenant_id`, `event_type`, `created_at`),
    KEY `idx_dad_order_action_log_actor` (`actor_member_uid`, `created_at`),
    KEY `idx_dad_order_action_log_goods` (`order_goods_uid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
