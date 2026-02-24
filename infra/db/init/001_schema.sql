SET NAMES utf8mb4;
SET time_zone = '+09:00';

/* ============================================================
   DISCOUNT ALL DAY (DAD) - Core Schema
   ============================================================ */

/* ------------------------------------------------------------
   1) Tenants
------------------------------------------------------------ */
CREATE TABLE IF NOT EXISTS dad_tenants (
                                           id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                                           slug            VARCHAR(64) NOT NULL,
    name            VARCHAR(128) NOT NULL,
    primary_domain  VARCHAR(255) NULL,
    status          VARCHAR(32) NOT NULL DEFAULT 'active',
    timezone        VARCHAR(64) NOT NULL DEFAULT 'Asia/Seoul',
    theme_json      JSON NULL,
    created_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uq_dad_tenants_slug (slug),
    UNIQUE KEY uq_dad_tenants_primary_domain (primary_domain),
    KEY idx_dad_tenants_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


/* ------------------------------------------------------------
   2) Users
------------------------------------------------------------ */
CREATE TABLE IF NOT EXISTS dad_users (
                                         id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                                         email             VARCHAR(255) NULL,
    phone             VARCHAR(50) NULL,
    name              VARCHAR(128) NOT NULL,
    password_hash     VARCHAR(255) NULL,
    kakao_provider_id VARCHAR(64) NULL,
    is_super_admin    TINYINT(1) NOT NULL DEFAULT 0,
    status            VARCHAR(32) NOT NULL DEFAULT 'active',
    created_at        DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at        DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uq_dad_users_email (email),
    UNIQUE KEY uq_dad_users_phone (phone),
    UNIQUE KEY uq_dad_users_kakao (kakao_provider_id),
    KEY idx_dad_users_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


/* ------------------------------------------------------------
   3) Tenant Memberships
------------------------------------------------------------ */
CREATE TABLE IF NOT EXISTS dad_tenant_memberships (
                                                      id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                                                      tenant_id  BIGINT UNSIGNED NOT NULL,
                                                      user_id    BIGINT UNSIGNED NOT NULL,
                                                      role       VARCHAR(32) NOT NULL DEFAULT 'MEMBER',
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uq_dad_membership_tenant_user (tenant_id, user_id),
    KEY idx_dad_membership_user (user_id),
    KEY idx_dad_membership_tenant_role (tenant_id, role),
    CONSTRAINT fk_dad_membership_tenant
    FOREIGN KEY (tenant_id) REFERENCES dad_tenants(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_dad_membership_user
    FOREIGN KEY (user_id) REFERENCES dad_users(id)
    ON DELETE RESTRICT ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


/* ------------------------------------------------------------
   4) Products
------------------------------------------------------------ */
CREATE TABLE IF NOT EXISTS dad_products (
                                            id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                                            tenant_id     BIGINT UNSIGNED NOT NULL,
                                            title         VARCHAR(255) NOT NULL,
    description   MEDIUMTEXT NULL,
    status        VARCHAR(32) NOT NULL DEFAULT 'draft',
    thumbnail_url VARCHAR(1024) NULL,
    images_json   JSON NULL,
    base_price    DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    pickup_only   TINYINT(1) NOT NULL DEFAULT 1,
    min_qty       INT UNSIGNED NULL,
    max_qty       INT UNSIGNED NULL,
    sale_start_at DATETIME(3) NULL,
    sale_end_at   DATETIME(3) NULL,
    created_by    BIGINT UNSIGNED NOT NULL,
    created_at    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    KEY idx_dad_products_tenant_status (tenant_id, status, updated_at),
    CONSTRAINT fk_dad_products_tenant
    FOREIGN KEY (tenant_id) REFERENCES dad_tenants(id),
    CONSTRAINT fk_dad_products_user
    FOREIGN KEY (created_by) REFERENCES dad_users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


/* ------------------------------------------------------------
   5) Product Options
------------------------------------------------------------ */
CREATE TABLE IF NOT EXISTS dad_product_options (
                                                   id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                                                   product_id BIGINT UNSIGNED NOT NULL,
                                                   name       VARCHAR(255) NOT NULL,
    sku        VARCHAR(64) NULL,
    price      DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    stock_qty  INT UNSIGNED NULL,
    is_active  TINYINT(1) NOT NULL DEFAULT 1,
    sort_order INT NOT NULL DEFAULT 0,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uq_dad_option_product_name (product_id, name),
    CONSTRAINT fk_dad_options_product
    FOREIGN KEY (product_id) REFERENCES dad_products(id)
                                                                 ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


/* ------------------------------------------------------------
   6) Orders
------------------------------------------------------------ */
CREATE TABLE IF NOT EXISTS dad_orders (
                                          id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                                          tenant_id         BIGINT UNSIGNED NOT NULL,
                                          order_no          VARCHAR(64) NOT NULL,
    user_id           BIGINT UNSIGNED NULL,
    buyer_name        VARCHAR(128) NOT NULL,
    buyer_phone       VARCHAR(50) NOT NULL,
    status            VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    payment_status    VARCHAR(32) NOT NULL DEFAULT 'unpaid',
    subtotal_amount   DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    discount_amount   DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    point_used_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    total_amount      DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    pickup_at         DATETIME(3) NULL,
    memo              VARCHAR(1024) NULL,
    created_at        DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at        DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uq_dad_orders_order_no (order_no),
    KEY idx_dad_orders_tenant_created (tenant_id, created_at),
    CONSTRAINT fk_dad_orders_tenant
    FOREIGN KEY (tenant_id) REFERENCES dad_tenants(id),
    CONSTRAINT fk_dad_orders_user
    FOREIGN KEY (user_id) REFERENCES dad_users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


/* ------------------------------------------------------------
   7) Order Items
------------------------------------------------------------ */
CREATE TABLE IF NOT EXISTS dad_order_items (
                                               id                   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                                               order_id             BIGINT UNSIGNED NOT NULL,
                                               product_id           BIGINT UNSIGNED NOT NULL,
                                               option_id            BIGINT UNSIGNED NULL,
                                               title_snapshot       VARCHAR(255) NOT NULL,
    option_name_snapshot VARCHAR(255) NULL,
    unit_price_snapshot  DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    qty                  INT UNSIGNED NOT NULL,
    line_total           DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    status               VARCHAR(32) NOT NULL DEFAULT 'normal',
    created_at           DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at           DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    CONSTRAINT fk_dad_items_order
    FOREIGN KEY (order_id) REFERENCES dad_orders(id)
                                                                           ON DELETE CASCADE,
    CONSTRAINT fk_dad_items_product
    FOREIGN KEY (product_id) REFERENCES dad_products(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


/* ------------------------------------------------------------
   8) Payments
------------------------------------------------------------ */
CREATE TABLE IF NOT EXISTS dad_payments (
                                            id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                                            order_id       BIGINT UNSIGNED NOT NULL,
                                            provider       VARCHAR(32) NOT NULL DEFAULT 'none',
    method         VARCHAR(32) NOT NULL DEFAULT 'none',
    status         VARCHAR(32) NOT NULL DEFAULT 'initiated',
    amount         DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    provider_tx_id VARCHAR(128) NULL,
    paid_at        DATETIME(3) NULL,
    raw_json       JSON NULL,
    created_at     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    CONSTRAINT fk_dad_payments_order
    FOREIGN KEY (order_id) REFERENCES dad_orders(id)
                                                                     ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


/* ------------------------------------------------------------
   9) Points Ledger
------------------------------------------------------------ */
CREATE TABLE IF NOT EXISTS dad_points_ledger (
                                                 id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                                                 tenant_id     BIGINT UNSIGNED NOT NULL,
                                                 user_id       BIGINT UNSIGNED NOT NULL,
                                                 type          VARCHAR(32) NOT NULL,
    amount        INT NOT NULL,
    balance_after INT NULL,
    reason        VARCHAR(255) NULL,
    order_id      BIGINT UNSIGNED NULL,
    created_at    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    CONSTRAINT fk_dad_points_tenant
    FOREIGN KEY (tenant_id) REFERENCES dad_tenants(id),
    CONSTRAINT fk_dad_points_user
    FOREIGN KEY (user_id) REFERENCES dad_users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


/* ------------------------------------------------------------
   Seed
------------------------------------------------------------ */
INSERT INTO dad_tenants (slug, name, primary_domain, status)
VALUES
    ('a', 'A 지점', 'a.example.com', 'active'),
    ('b', 'B 지점', 'b.example.com', 'active');

INSERT INTO dad_users (email, name, password_hash, is_super_admin, status)
VALUES
    ('admin@example.com', 'Super Admin', 'TEMP_HASH', 1, 'active');