-- ============================================================================
-- PublicLab Migration 004: Patient Report Access OTP Support
-- ============================================================================

-- 1. Allow nullable user_id in email_otps for non-registered patient report verification
ALTER TABLE email_otps ALTER COLUMN user_id DROP NOT NULL;

-- 2. Create index on email and purpose for rapid OTP lookup
CREATE INDEX IF NOT EXISTS email_otps_email_purpose_idx ON email_otps(LOWER(email), purpose);
