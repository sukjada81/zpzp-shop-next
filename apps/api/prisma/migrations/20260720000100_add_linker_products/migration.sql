CREATE TABLE `mallRN_linker_products` (
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
  KEY `idx_linker_product_uid` (`product_uid`),
  CONSTRAINT `fk_linker_product_linker` FOREIGN KEY (`linker_uid`) REFERENCES `zpzp_linker` (`uid`),
  CONSTRAINT `fk_linker_product_goods` FOREIGN KEY (`product_uid`) REFERENCES `mallRN_goods` (`uid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `mallRN_linker_product_logs` (
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
  KEY `idx_linker_log_request` (`request_id`),
  CONSTRAINT `fk_linker_product_log_linker` FOREIGN KEY (`linker_uid`) REFERENCES `zpzp_linker` (`uid`),
  CONSTRAINT `fk_linker_product_log_goods` FOREIGN KEY (`product_uid`) REFERENCES `mallRN_goods` (`uid`),
  CONSTRAINT `fk_linker_product_log_selection` FOREIGN KEY (`linker_product_uid`) REFERENCES `mallRN_linker_products` (`uid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `zpzp_setting` (`name`, `value`)
VALUES ('linker_slot_default', '20')
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);
