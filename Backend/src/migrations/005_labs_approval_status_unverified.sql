-- ============================================================================
-- PublicLab Migration 005: Add 'unverified' to labs_approval_status_check
-- ============================================================================

-- Safely update labs_approval_status_check constraint to include 'unverified'
ALTER TABLE labs DROP CONSTRAINT IF EXISTS labs_approval_status_check;

ALTER TABLE labs ADD CONSTRAINT labs_approval_status_check
    CHECK (approval_status IN ('unverified', 'pending', 'approved', 'rejected', 'suspended'));
