CREATE TABLE IF NOT EXISTS `zpzp_linker` (
  `uid` INT NOT NULL AUTO_INCREMENT,
  `member_uid` INT UNSIGNED NOT NULL,
  `shop_slug` VARCHAR(64) NOT NULL,
  `shop_name` VARCHAR(191) NOT NULL DEFAULT '',
  `tenant_id` BIGINT NULL,
  `status` ENUM('pending', 'active', 'suspended', 'rejected') NOT NULL DEFAULT 'pending',
  `approved_at` DATETIME NULL,
  `reject_reason` VARCHAR(500) NULL,
  `agreed_service_at` DATETIME NULL,
  `agreed_settlement_at` DATETIME NULL,
  `approved_by` VARCHAR(50) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`uid`),
  UNIQUE KEY `uq_zpzp_linker_member` (`member_uid`),
  UNIQUE KEY `uq_zpzp_linker_slug` (`shop_slug`),
  KEY `ix_zpzp_linker_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `zpzp_referral_attribution` (
  `uid` INT NOT NULL AUTO_INCREMENT,
  `member_uid` INT UNSIGNED NOT NULL,
  `linker_id` INT NOT NULL,
  `attributed_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `landing_slug` VARCHAR(64) NULL,
  `source` ENUM('subdomain', 'manual') NOT NULL DEFAULT 'subdomain',
  `crew_status` ENUM('prospect', 'confirmed', 'revoked') NOT NULL DEFAULT 'prospect',
  `crew_confirmed_at` DATETIME NULL,
  `crew_revoked_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`uid`),
  UNIQUE KEY `uq_zpzp_attr_member` (`member_uid`),
  KEY `ix_zpzp_attr_count` (`linker_id`, `crew_status`, `crew_confirmed_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `zpzp_setting` (
  `name` VARCHAR(64) NOT NULL,
  `value` VARCHAR(255) NOT NULL DEFAULT '',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `mallRN_linker_products` (
  `uid` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `linker_uid` INT NOT NULL,
  `product_uid` INT UNSIGNED NOT NULL,
  `selection_status` VARCHAR(20) NOT NULL DEFAULT 'selected',
  `display_status` VARCHAR(20) NOT NULL DEFAULT 'visible',
  `display_order` INT UNSIGNED NOT NULL DEFAULT 0,
  `product_status_snapshot` VARCHAR(20) NOT NULL DEFAULT '',
  `selected_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `selected_by` INT UNSIGNED NULL,
  `removed_at` DATETIME NULL,
  `removed_by` INT UNSIGNED NULL,
  `remove_reason` VARCHAR(255) NULL,
  `last_status_checked_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`uid`),
  UNIQUE KEY `uq_linker_product` (`linker_uid`, `product_uid`),
  KEY `idx_linker_selection` (`linker_uid`, `selection_status`),
  KEY `idx_linker_display_order` (`linker_uid`, `display_status`, `display_order`),
  KEY `idx_linker_product_uid` (`product_uid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `mallRN_linker_product_logs` (
  `uid` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `linker_uid` INT NOT NULL,
  `product_uid` INT UNSIGNED NULL,
  `linker_product_uid` BIGINT UNSIGNED NULL,
  `action_type` VARCHAR(30) NOT NULL,
  `action_scope` VARCHAR(20) NOT NULL DEFAULT 'single',
  `previous_value` JSON NULL,
  `changed_value` JSON NULL,
  `slot_limit_snapshot` INT UNSIGNED NOT NULL DEFAULT 0,
  `slot_used_before` INT UNSIGNED NOT NULL DEFAULT 0,
  `slot_used_after` INT UNSIGNED NOT NULL DEFAULT 0,
  `product_status_snapshot` VARCHAR(20) NULL,
  `reason` VARCHAR(255) NULL,
  `request_id` VARCHAR(50) NOT NULL,
  `actor_type` VARCHAR(20) NOT NULL DEFAULT 'linker',
  `actor_uid` INT UNSIGNED NULL,
  `ip_address` VARCHAR(45) NULL,
  `user_agent` VARCHAR(500) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`uid`),
  KEY `idx_linker_log_created` (`linker_uid`, `created_at`),
  KEY `idx_linker_log_product` (`product_uid`),
  KEY `idx_linker_log_request` (`request_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `zpzp_setting` (`name`, `value`)
VALUES ('linker_slot_default', '20')
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);
