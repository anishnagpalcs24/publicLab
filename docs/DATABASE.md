# PublicLab Database Documentation

## 1. Overview

**Engine:** PostgreSQL 18  
**Driver:** `pg` (Node-Postgres Connection Pool)  
**Database Name:** `publiclab`  
**Migration Tool:** `Backend/src/migrations/runMigration.js` (`npm run migrate`)  

All database tables use parameterized queries and standard relational constraints (Primary Keys, Foreign Keys, Unique constraints, Check constraints, and Indexes).

---

## 2. Verified PostgreSQL Schema

### 2.1 `users`
Stores user accounts for patients, laboratory administrators, lab staff, and platform administrators.
- `id` (BIGINT GENERATED ALWAYS AS IDENTITY, PRIMARY KEY)
- `full_name` (VARCHAR, NOT NULL)
- `email` (VARCHAR, UNIQUE LOWER CASE index)
- `phone` (VARCHAR, UNIQUE index)
- `password_hash` (TEXT)
- `account_status` (VARCHAR, DEFAULT 'pending', CHECK: active, pending, suspended, deactivated)
- `email_verified` (BOOLEAN, DEFAULT FALSE)
- `role` (VARCHAR(50), DEFAULT 'patient')
- `lab_id` (BIGINT, FOREIGN KEY REFERENCES `labs(id)`)
- `created_at` (TIMESTAMPTZ, DEFAULT NOW())
- `updated_at` (TIMESTAMPTZ, DEFAULT NOW())

### 2.2 `auth_sessions`
Production-grade session management storing cryptographic hashes of JWT refresh tokens.
- `id` (BIGINT GENERATED ALWAYS AS IDENTITY, PRIMARY KEY)
- `user_id` (BIGINT, FOREIGN KEY REFERENCES `users(id)` ON DELETE CASCADE)
- `refresh_token_hash` (VARCHAR(255), NOT NULL, indexed)
- `ip_address` (VARCHAR(100))
- `user_agent` (TEXT)
- `expires_at` (TIMESTAMPTZ, NOT NULL)
- `is_revoked` (BOOLEAN, DEFAULT FALSE, indexed)
- `revoked_at` (TIMESTAMPTZ)
- `created_at` (TIMESTAMPTZ, DEFAULT NOW())
- `updated_at` (TIMESTAMPTZ, DEFAULT NOW())

### 2.3 `email_otps`
Stores single-use, time-limited cryptographic hashes of 6-digit email verification OTPs.
- `id` (BIGINT GENERATED ALWAYS AS IDENTITY, PRIMARY KEY)
- `user_id` (BIGINT, FOREIGN KEY REFERENCES `users(id)` ON DELETE CASCADE)
- `email` (VARCHAR(255), NOT NULL, indexed)
- `otp_hash` (VARCHAR(255), NOT NULL)
- `purpose` (VARCHAR(50), DEFAULT 'email_verification', indexed)
- `expires_at` (TIMESTAMPTZ, NOT NULL)
- `attempts` (INTEGER, DEFAULT 0)
- `is_used` (BOOLEAN, DEFAULT FALSE)
- `created_at` (TIMESTAMPTZ, DEFAULT NOW())

### 2.4 `labs`
Stores registered diagnostic laboratory organisations.
- `id` (BIGINT GENERATED ALWAYS AS IDENTITY, PRIMARY KEY)
- `owner_id` (BIGINT, FOREIGN KEY REFERENCES `users(id)` ON DELETE SET NULL)
- `name` (VARCHAR, NOT NULL)
- `registration_number` (VARCHAR, UNIQUE index)
- `email` (VARCHAR, UNIQUE LOWER CASE index)
- `phone` (VARCHAR)
- `description` (TEXT)
- `address` (TEXT)
- `city` (VARCHAR(100))
- `operating_hours` (JSONB)
- `services` (JSONB)
- `sample_collection_available` (BOOLEAN, DEFAULT FALSE)
- `approval_status` (VARCHAR, DEFAULT 'pending', CHECK: pending, approved, rejected, suspended)
- `rejection_reason` (TEXT)
- `rejection_notes` (TEXT)
- `suspension_reason` (TEXT)
- `created_at` (TIMESTAMPTZ, DEFAULT NOW())
- `updated_at` (TIMESTAMPTZ, DEFAULT NOW())

### 2.5 `patients`
Stores patient identities.
- `id` (BIGINT GENERATED ALWAYS AS IDENTITY, PRIMARY KEY)
- `full_name` (VARCHAR, NOT NULL)
- `date_of_birth` (DATE)
- `sex` (VARCHAR)
- `phone` (VARCHAR(50))
- `email` (VARCHAR(255))
- `address` (TEXT)
- `created_at` (TIMESTAMPTZ, DEFAULT NOW())
- `updated_at` (TIMESTAMPTZ, DEFAULT NOW())

### 2.6 `lab_patient_refs`
Scoping table mapping laboratory-specific patient codes to global patient IDs to prevent cross-lab patient data leaks.
- `id` (BIGINT GENERATED ALWAYS AS IDENTITY, PRIMARY KEY)
- `lab_id` (BIGINT, FOREIGN KEY REFERENCES `labs(id)`)
- `patient_id` (BIGINT, FOREIGN KEY REFERENCES `patients(id)`)
- `local_patient_code` (VARCHAR, NOT NULL)
- `created_at` (TIMESTAMPTZ, DEFAULT NOW())
- UNIQUE (`lab_id`, `local_patient_code`)
- UNIQUE (`lab_id`, `patient_id`)

### 2.7 `orders`
Stores diagnostic test orders created by laboratories for patients.
- `id` (BIGINT GENERATED ALWAYS AS IDENTITY, PRIMARY KEY)
- `lab_id` (BIGINT, FOREIGN KEY REFERENCES `labs(id)`)
- `patient_id` (BIGINT, FOREIGN KEY REFERENCES `patients(id)`)
- `order_status` (VARCHAR(50), CHECK: created, confirmed, processing, completed, cancelled)
- `payment_status` (VARCHAR(50), CHECK: pending, partial, paid, refunded, failed)
- `total_amount` (NUMERIC(12,2), DEFAULT 0.00)
- `sample_collected_at` (TIMESTAMPTZ)
- `notes` (TEXT)
- `created_by` (BIGINT, FOREIGN KEY REFERENCES `users(id)`)
- `created_at` (TIMESTAMPTZ, DEFAULT NOW())
- `updated_at` (TIMESTAMPTZ, DEFAULT NOW())

### 2.8 `order_items`
Individual tests included in an order.
- `id` (BIGINT GENERATED ALWAYS AS IDENTITY, PRIMARY KEY)
- `order_id` (BIGINT, FOREIGN KEY REFERENCES `orders(id)` ON DELETE CASCADE)
- `test_id` (BIGINT, NOT NULL)
- `quantity` (INTEGER, DEFAULT 1)
- `unit_price` (NUMERIC(12,2), DEFAULT 0.00)
- `created_at` (TIMESTAMPTZ, DEFAULT NOW())

### 2.9 `reports`
Diagnostic report metadata and private file storage references.
- `id` (BIGINT GENERATED ALWAYS AS IDENTITY, PRIMARY KEY)
- `order_id` (BIGINT, FOREIGN KEY REFERENCES `orders(id)`)
- `patient_id` (BIGINT, FOREIGN KEY REFERENCES `patients(id)`)
- `lab_id` (BIGINT, FOREIGN KEY REFERENCES `labs(id)`)
- `storage_provider` (VARCHAR(50), DEFAULT 'local')
- `storage_key` (VARCHAR(500), NOT NULL)
- `filename` (VARCHAR(255))
- `original_filename` (VARCHAR(255))
- `mime_type` (VARCHAR(100), DEFAULT 'application/pdf')
- `file_size` (BIGINT, DEFAULT 0)
- `file_size_bytes` (BIGINT, DEFAULT 0)
- `status` (VARCHAR(50), DEFAULT 'draft')
- `uploaded_by` (BIGINT, FOREIGN KEY REFERENCES `users(id)`)
- `published_at` (TIMESTAMPTZ)
- `created_at` (TIMESTAMPTZ, DEFAULT NOW())
- `updated_at` (TIMESTAMPTZ, DEFAULT NOW())

### 2.10 `report_versions`
Historical record of corrected or re-uploaded medical reports.
- `id` (BIGINT GENERATED ALWAYS AS IDENTITY, PRIMARY KEY)
- `report_id` (BIGINT, FOREIGN KEY REFERENCES `reports(id)` ON DELETE CASCADE)
- `version_number` (INTEGER, NOT NULL)
- `storage_key` (VARCHAR(500), NOT NULL)
- `original_filename` (VARCHAR(255))
- `correction_reason` (TEXT)
- `uploaded_by` (BIGINT, FOREIGN KEY REFERENCES `users(id)`)
- `created_at` (TIMESTAMPTZ, DEFAULT NOW())

### 2.11 `callbacks`
Visitor callback requests submitted to labs.
- `id` (BIGINT GENERATED ALWAYS AS IDENTITY, PRIMARY KEY)
- `name` (VARCHAR(255), NOT NULL)
- `phone` (VARCHAR(50), NOT NULL)
- `email` (VARCHAR(255))
- `lab_id` (BIGINT, FOREIGN KEY REFERENCES `labs(id)`)
- `message` (TEXT)
- `callback_status` (VARCHAR(50), DEFAULT 'pending')
- `assigned_to` (BIGINT, FOREIGN KEY REFERENCES `users(id)`)
- `requested_at` (TIMESTAMPTZ, DEFAULT NOW())
- `contacted_at` (TIMESTAMPTZ)
- `created_at` (TIMESTAMPTZ, DEFAULT NOW())
- `updated_at` (TIMESTAMPTZ, DEFAULT NOW())

### 2.12 `subscription_plans`
Platform SaaS plans available to diagnostic laboratories.
- `id` (BIGINT GENERATED ALWAYS AS IDENTITY, PRIMARY KEY)
- `name` (VARCHAR(255), NOT NULL)
- `plan_code` (VARCHAR(100), UNIQUE NOT NULL)
- `description` (TEXT)
- `price` (NUMERIC(12,2), NOT NULL)
- `currency` (VARCHAR(10), DEFAULT 'INR')
- `billing_interval` (VARCHAR(50), DEFAULT 'monthly')
- `is_active` (BOOLEAN, DEFAULT TRUE)
- `created_at` (TIMESTAMPTZ, DEFAULT NOW())
- `updated_at` (TIMESTAMPTZ, DEFAULT NOW())

### 2.13 `subscriptions`
Active and historical lab subscriptions.
- `id` (BIGINT GENERATED ALWAYS AS IDENTITY, PRIMARY KEY)
- `lab_id` (BIGINT, FOREIGN KEY REFERENCES `labs(id)`)
- `plan_id` (BIGINT, FOREIGN KEY REFERENCES `subscription_plans(id)`)
- `status` (VARCHAR(50), DEFAULT 'pending')
- `provider` (VARCHAR(50))
- `provider_subscription_id` (VARCHAR(255))
- `current_period_start` (TIMESTAMPTZ)
- `current_period_end` (TIMESTAMPTZ)
- `canceled_at` (TIMESTAMPTZ)
- `created_at` (TIMESTAMPTZ, DEFAULT NOW())
- `updated_at` (TIMESTAMPTZ, DEFAULT NOW())

### 2.14 `payments`
Financial transactions for test orders or SaaS subscriptions.
- `id` (BIGINT GENERATED ALWAYS AS IDENTITY, PRIMARY KEY)
- `order_id` (BIGINT, FOREIGN KEY REFERENCES `orders(id)`)
- `subscription_id` (BIGINT, FOREIGN KEY REFERENCES `subscriptions(id)`)
- `amount` (NUMERIC(12,2), NOT NULL)
- `currency` (VARCHAR(10), DEFAULT 'INR')
- `provider` (VARCHAR(50))
- `idempotency_key` (VARCHAR(255), UNIQUE NOT NULL)
- `payment_method` (VARCHAR(50))
- `provider_payment_id` (VARCHAR(255))
- `payment_status` (VARCHAR(50), DEFAULT 'pending')
- `failure_reason` (TEXT)
- `paid_at` (TIMESTAMPTZ)
- `created_at` (TIMESTAMPTZ, DEFAULT NOW())
- `updated_at` (TIMESTAMPTZ, DEFAULT NOW())

### 2.15 `payment_webhook_events`
Stores inbound webhook event IDs to prevent duplicate processing (replay protection).
- `id` (BIGINT GENERATED ALWAYS AS IDENTITY, PRIMARY KEY)
- `provider` (VARCHAR(50), NOT NULL)
- `provider_event_id` (VARCHAR(255), NOT NULL)
- `event_type` (VARCHAR(100), NOT NULL)
- `payment_id` (BIGINT, FOREIGN KEY REFERENCES `payments(id)`)
- `created_at` (TIMESTAMPTZ, DEFAULT NOW())
- UNIQUE (`provider`, `provider_event_id`)

### 2.16 `clinical_calculations`
Stores saved clinical calculator evaluations (eGFR, LDL, HOMA-IR, FAI) with formula versions, input parameters, and patient associations.
- `id` (BIGINT GENERATED ALWAYS AS IDENTITY, PRIMARY KEY)
- `lab_id` (BIGINT, FOREIGN KEY REFERENCES `labs(id)` ON DELETE CASCADE)
- `patient_id` (BIGINT, FOREIGN KEY REFERENCES `patients(id)` ON DELETE SET NULL)
- `created_by` (BIGINT, FOREIGN KEY REFERENCES `users(id)` ON DELETE SET NULL)
- `calculator_type` (VARCHAR(50), NOT NULL, indexed: egfr, ldl, homa_ir, fai)
- `formula_name` (VARCHAR(100), NOT NULL)
- `input_parameters` (JSONB, NOT NULL DEFAULT '{}')
- `result_value` (NUMERIC(10,4), NOT NULL)
- `result_unit` (VARCHAR(50), NOT NULL)
- `interpretation` (TEXT)
- `clinical_notes` (TEXT)
- `created_at` (TIMESTAMPTZ, DEFAULT NOW(), indexed)


---

## 3. Migration Commands & Verification

To run all database migrations:
```bash
cd Backend
npm run migrate
```

### Verification Query in pgAdmin 4:
To inspect all tables in the `publiclab` database:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```
