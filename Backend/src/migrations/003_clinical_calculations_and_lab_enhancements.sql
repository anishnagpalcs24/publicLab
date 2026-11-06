-- ============================================================================
-- PublicLab Migration 003: Clinical Calculations & Lab Owner Enhancements
-- Safe, additive migration: never drops or truncates existing tables or data
-- ============================================================================

-- 1. Extend labs table with owner linkage and operational fields
ALTER TABLE labs ADD COLUMN IF NOT EXISTS owner_id BIGINT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE labs ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE labs ADD COLUMN IF NOT EXISTS city VARCHAR(100);
ALTER TABLE labs ADD COLUMN IF NOT EXISTS operating_hours JSONB DEFAULT '{"monday_friday": "08:00 - 20:00", "saturday": "08:00 - 16:00", "sunday": "Closed"}'::jsonb;
ALTER TABLE labs ADD COLUMN IF NOT EXISTS services JSONB DEFAULT '[]'::jsonb;
ALTER TABLE labs ADD COLUMN IF NOT EXISTS sample_collection_available BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE labs ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE labs ADD COLUMN IF NOT EXISTS rejection_notes TEXT;
ALTER TABLE labs ADD COLUMN IF NOT EXISTS suspension_reason TEXT;
ALTER TABLE labs ADD COLUMN IF NOT EXISTS technical_contact JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS labs_owner_id_idx ON labs(owner_id);
CREATE INDEX IF NOT EXISTS labs_city_idx ON labs(city);

-- 2. Extend patients table with optional contact fields
ALTER TABLE patients ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS address TEXT;

CREATE INDEX IF NOT EXISTS patients_phone_idx ON patients(phone);

-- 3. Extend orders table with collection tracking and creator
ALTER TABLE orders ADD COLUMN IF NOT EXISTS sample_collected_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS created_by BIGINT REFERENCES users(id) ON DELETE SET NULL;

-- 4. Clinical Calculations table
CREATE TABLE IF NOT EXISTS clinical_calculations (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    lab_id BIGINT NOT NULL REFERENCES labs(id) ON DELETE CASCADE,
    patient_id BIGINT REFERENCES patients(id) ON DELETE SET NULL,
    created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    calculator_type VARCHAR(50) NOT NULL,
    formula_name VARCHAR(100) NOT NULL,
    input_parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
    result_value NUMERIC(10, 4) NOT NULL,
    result_unit VARCHAR(50) NOT NULL,
    interpretation TEXT,
    clinical_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS clinical_calculations_lab_id_idx ON clinical_calculations(lab_id);
CREATE INDEX IF NOT EXISTS clinical_calculations_patient_id_idx ON clinical_calculations(patient_id);
CREATE INDEX IF NOT EXISTS clinical_calculations_type_idx ON clinical_calculations(calculator_type);
CREATE INDEX IF NOT EXISTS clinical_calculations_created_at_idx ON clinical_calculations(created_at DESC);

