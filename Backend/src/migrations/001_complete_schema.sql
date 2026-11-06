-- ============================================================================
-- PublicLab Database Migration 001: Schema Completion
-- Safe, additive migration: never drops or truncates existing tables or data
-- ============================================================================

-- 1. Users table extension (add role and lab_id for role-based access control)
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'patient';
ALTER TABLE users ADD COLUMN IF NOT EXISTS lab_id BIGINT REFERENCES labs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS users_role_idx ON users(role);
CREATE INDEX IF NOT EXISTS users_lab_id_idx ON users(lab_id);

-- 2. Orders table
CREATE TABLE IF NOT EXISTS orders (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    lab_id BIGINT NOT NULL REFERENCES labs(id) ON DELETE RESTRICT,
    patient_id BIGINT NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
    order_status VARCHAR(50) NOT NULL DEFAULT 'pending',
    payment_status VARCHAR(50) NOT NULL DEFAULT 'pending',
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_status VARCHAR(50) DEFAULT 'pending';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'pending';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS total_amount NUMERIC(12, 2) DEFAULT 0.00;

CREATE INDEX IF NOT EXISTS orders_lab_id_idx ON orders(lab_id);
CREATE INDEX IF NOT EXISTS orders_patient_id_idx ON orders(patient_id);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders(order_status, payment_status);

-- 3. Order Items table
CREATE TABLE IF NOT EXISTS order_items (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    test_id BIGINT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON order_items(order_id);

-- 4. Reports table
CREATE TABLE IF NOT EXISTS reports (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    patient_id BIGINT NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
    lab_id BIGINT NOT NULL REFERENCES labs(id) ON DELETE RESTRICT,
    storage_provider VARCHAR(50) NOT NULL DEFAULT 'local',
    storage_key VARCHAR(500) NOT NULL,
    filename VARCHAR(255),
    original_filename VARCHAR(255),
    mime_type VARCHAR(100) NOT NULL DEFAULT 'application/pdf',
    file_size BIGINT DEFAULT 0,
    file_size_bytes BIGINT DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    report_status VARCHAR(50) DEFAULT 'draft',
    uploaded_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE reports ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'draft';
ALTER TABLE reports ADD COLUMN IF NOT EXISTS report_status VARCHAR(50) DEFAULT 'draft';
ALTER TABLE reports ADD COLUMN IF NOT EXISTS filename VARCHAR(255);
ALTER TABLE reports ADD COLUMN IF NOT EXISTS original_filename VARCHAR(255);
ALTER TABLE reports ADD COLUMN IF NOT EXISTS file_size BIGINT DEFAULT 0;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT DEFAULT 0;

CREATE INDEX IF NOT EXISTS reports_order_id_idx ON reports(order_id);
CREATE INDEX IF NOT EXISTS reports_lab_id_idx ON reports(lab_id);
CREATE INDEX IF NOT EXISTS reports_patient_id_idx ON reports(patient_id);
CREATE INDEX IF NOT EXISTS reports_status_idx ON reports(status);

-- 5. Report Versions table
CREATE TABLE IF NOT EXISTS report_versions (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    report_id BIGINT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    storage_key VARCHAR(500) NOT NULL,
    original_filename VARCHAR(255),
    correction_reason TEXT,
    uploaded_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS report_versions_report_id_idx ON report_versions(report_id, version_number);

-- 6. Callbacks table
CREATE TABLE IF NOT EXISTS callbacks (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    lab_id BIGINT REFERENCES labs(id) ON DELETE SET NULL,
    message TEXT,
    callback_status VARCHAR(50) NOT NULL DEFAULT 'pending',
    assigned_to BIGINT REFERENCES users(id) ON DELETE SET NULL,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    contacted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE callbacks ADD COLUMN IF NOT EXISTS callback_status VARCHAR(50) DEFAULT 'pending';
ALTER TABLE callbacks ADD COLUMN IF NOT EXISTS requested_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE callbacks ADD COLUMN IF NOT EXISTS contacted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS callbacks_status_idx ON callbacks(callback_status);
CREATE INDEX IF NOT EXISTS callbacks_lab_id_idx ON callbacks(lab_id);

-- 7. Subscription Plans table
CREATE TABLE IF NOT EXISTS subscription_plans (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    plan_code VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    price NUMERIC(12, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    billing_interval VARCHAR(50) NOT NULL DEFAULT 'monthly',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    lab_id BIGINT NOT NULL REFERENCES labs(id) ON DELETE RESTRICT,
    plan_id BIGINT NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    provider VARCHAR(50),
    provider_subscription_id VARCHAR(255),
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    canceled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending';

CREATE INDEX IF NOT EXISTS subscriptions_lab_id_idx ON subscriptions(lab_id);
CREATE INDEX IF NOT EXISTS subscriptions_status_idx ON subscriptions(status);

-- 9. Payments table
CREATE TABLE IF NOT EXISTS payments (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id BIGINT REFERENCES orders(id) ON DELETE SET NULL,
    subscription_id BIGINT REFERENCES subscriptions(id) ON DELETE SET NULL,
    amount NUMERIC(12, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    provider VARCHAR(50),
    idempotency_key VARCHAR(255) UNIQUE NOT NULL,
    payment_method VARCHAR(50),
    provider_payment_id VARCHAR(255),
    payment_status VARCHAR(50) NOT NULL DEFAULT 'pending',
    failure_reason TEXT,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT payments_target_check CHECK (
        (order_id IS NOT NULL AND subscription_id IS NULL) OR
        (order_id IS NULL AND subscription_id IS NOT NULL)
    )
);

ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'pending';

CREATE INDEX IF NOT EXISTS payments_order_id_idx ON payments(order_id);
CREATE INDEX IF NOT EXISTS payments_subscription_id_idx ON payments(subscription_id);
CREATE INDEX IF NOT EXISTS payments_idempotency_key_idx ON payments(idempotency_key);
CREATE INDEX IF NOT EXISTS payments_status_idx ON payments(payment_status);

-- 10. Payment Webhook Events table (for idempotency and replay protection)
CREATE TABLE IF NOT EXISTS payment_webhook_events (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    provider VARCHAR(50) NOT NULL,
    provider_event_id VARCHAR(255) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    payment_id BIGINT REFERENCES payments(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT payment_webhook_events_unique UNIQUE (provider, provider_event_id)
);

-- Seed initial default subscription plans if empty
INSERT INTO subscription_plans (name, plan_code, description, price, currency, billing_interval)
VALUES 
    ('Basic Lab', 'plan_basic_monthly', 'Access for small diagnostic centres up to 500 reports/month', 999.00, 'INR', 'monthly'),
    ('Standard Lab', 'plan_std_monthly', 'Access for multi-branch diagnostic laboratories up to 5000 reports/month', 2499.00, 'INR', 'monthly'),
    ('Enterprise Lab', 'plan_ent_annual', 'Unlimited reports, priority support, and multi-location analytics', 24999.00, 'INR', 'yearly')
ON CONFLICT (plan_code) DO NOTHING;

