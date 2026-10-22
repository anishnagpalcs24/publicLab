# PublicLab Database Design

## 1. Database Technology

- **Database:** PostgreSQL
- **Database Driver:** `pg` (node-postgres)
- **Database Name:** `publiclab`
- **Database Connection:** PostgreSQL connection URI stored in environment variables
- **Query Approach:** SQL queries through a shared PostgreSQL connection pool

The database schema will evolve as requirements are implemented, tested, and reviewed.

PostgreSQL uses relational tables, primary keys, foreign keys, constraints, indexes, and transactions to maintain data integrity.

## 2. Planned Database Tables

### 2.1 Users

Stores account and authentication information for registered users, laboratory owners, laboratory staff, and administrators.

Potential fields:

- `id` — primary key
- `email` — normalized email address, where applicable
- `email_verified_at` — email verification timestamp
- `password_hash` — password hash, where password authentication is used
- `account_status` — active, suspended, or other defined states
- `created_at`
- `updated_at`

Authentication roles and permissions should be modelled explicitly. A user may have different authorised roles depending on their responsibilities.

### 2.2 Roles and User Role Assignments

Defines permissions for the three portals.

Potential tables:

- `roles`
- `user_roles`
- `permissions` (if a more detailed permission system is required)

Roles may include:

- User / Patient
- Laboratory Owner
- Laboratory Staff
- PublicLab Administrator

Administrative access must be restricted to authorised members of the PublicLab team.

### 2.3 Labs

Stores diagnostic laboratory organisation details.

Potential fields:

- `id` — primary key
- `name`
- `description`
- `public_email`
- `public_phone`
- `approval_status`
- `verification_status`
- `approved_by` — reference to an authorised administrator, where applicable
- `approved_at`
- `created_at`
- `updated_at`

Approval statuses may include pending, approved, rejected, and suspended.

Public contact information and internal verification documents must be handled separately.

### 2.4 Lab Branches

Allows one laboratory organisation to operate multiple diagnostic centres or branches.

Potential fields:

- `id` — primary key
- `lab_id` — foreign key referencing `labs.id`
- `branch_name`
- `address_line`
- `city`
- `state`
- `postal_code`
- `latitude`
- `longitude`
- `contact_phone`
- `opening_hours`
- `created_at`
- `updated_at`

Approved and published branches can appear in public laboratory searches.

### 2.5 Lab Staff

Manages authorised staff and their relationships with laboratories.

Potential fields:

- `id` — primary key
- `lab_id` — foreign key referencing `labs.id`
- `user_id` — foreign key referencing `users.id`
- `branch_id` — optional foreign key referencing `lab_branches.id`
- `staff_role`
- `status`
- `created_at`
- `updated_at`

Only authorised staff should be able to access the patients and records permitted by their assigned responsibilities.

### 2.6 Patients

Stores patient identity information.

Potential fields:

- `id` — primary key
- `user_id` — optional foreign key referencing `users.id` when the patient claims an account
- `full_name`
- `date_of_birth` — where required
- `gender` — where required
- `created_at`
- `updated_at`

Patient identity must not be inferred solely from matching names, email addresses, or phone numbers.

### 2.7 Patient Contact Details and Verification

Patient contact information and verification state should be managed with appropriate access controls.

Potential fields:

- `id` — primary key
- `patient_id` — foreign key referencing `patients.id`
- `contact_type` — email or phone
- `contact_value`
- `verified_at`
- `created_at`
- `updated_at`

Use appropriate uniqueness rules only after defining the product's identity and account-linking requirements. Do not assume every patient has a unique phone number.

OTP challenges should be stored separately, with expiration, attempt limits, and secure verification handling.

### 2.8 Lab Patient References

Maps PublicLab patient identities to laboratory-specific patient identifiers.

Potential fields:

- `id` — primary key
- `patient_id` — foreign key referencing `patients.id`
- `lab_id` — foreign key referencing `labs.id`
- `lab_patient_identifier`
- `link_status`
- `created_at`
- `updated_at`

A laboratory's local patient identifier must be scoped to that laboratory. One laboratory must not be able to use another laboratory's patient identifier to access records.

### 2.9 Test Catalogue

Stores diagnostic tests offered by participating laboratories.

Potential fields:

- `id` — primary key
- `name`
- `description`
- `category`
- `sample_type`
- `is_active`
- `created_at`
- `updated_at`

If test prices or availability differ between laboratories, those details should be stored in a separate laboratory-specific test offering table.

### 2.10 Orders

Represents a diagnostic testing transaction for a patient.

Potential fields:

- `id` — primary key
- `lab_id` — foreign key referencing `labs.id`
- `branch_id` — optional foreign key referencing `lab_branches.id`
- `patient_id` — foreign key referencing `patients.id`
- `lab_patient_reference_id` — optional reference to the patient's laboratory-specific identifier
- `order_number`
- `order_date`
- `order_status`
- `total_amount`
- `currency`
- `created_by` — reference to the authorised user who created the order
- `created_at`
- `updated_at`

Orders should preserve the laboratory responsible for the transaction and support auditability.

### 2.11 Order Items

An order may contain multiple diagnostic tests.

Potential fields:

- `id` — primary key
- `order_id` — foreign key referencing `orders.id`
- `test_id` — foreign key referencing `tests.id`
- `test_name_snapshot`
- `price_at_order`
- `test_status`
- `created_at`
- `updated_at`

The snapshot fields preserve relevant order details even if the test catalogue changes later.

### 2.12 Reports

Stores diagnostic report metadata and private file-storage references.

Potential fields:

- `id` — primary key
- `order_item_id` — foreign key referencing `order_items.id`
- `patient_id` — foreign key referencing `patients.id`
- `lab_id` — foreign key referencing `labs.id`
- `storage_object_key`
- `report_status`
- `uploaded_by` — reference to the authorised uploader
- `published_at`
- `created_at`
- `updated_at`

Reports must not be publicly accessible by guessing a URL or identifier. Files should be stored in private object storage, with access authorised by the backend.

### 2.13 Report Versions

Tracks corrected, replaced, or updated reports without silently overwriting the original record.

Potential fields:

- `id` — primary key
- `report_id` — foreign key referencing `reports.id`
- `version_number`
- `storage_object_key`
- `correction_reason`
- `uploaded_by`
- `created_at`

Report corrections must be auditable. The system should preserve the relevant history and clearly identify the current valid version.

### 2.14 Payments

Tracks patient payments and other supported payment transactions.

Potential fields:

- `id` — primary key
- `order_id` — optional foreign key referencing `orders.id`
- `lab_id` — optional foreign key referencing `labs.id`
- `payment_purpose`
- `amount`
- `currency`
- `payment_status`
- `payment_provider`
- `provider_payment_reference`
- `verified_at`
- `created_at`
- `updated_at`

Payment status must be verified by the backend using trusted provider responses or verified webhooks, not solely by frontend input.

An order's payment status should distinguish paid, pending, partially paid, failed, and refunded states where applicable.

### 2.15 Lab Subscriptions

Tracks laboratory subscriptions to PublicLab's future paid service.

Potential fields:

- `id` — primary key
- `lab_id` — foreign key referencing `labs.id`
- `plan_name` or `plan_id`
- `billing_interval`
- `subscription_status`
- `current_period_start`
- `current_period_end`
- `provider_subscription_reference`
- `created_at`
- `updated_at`

Subscription access and billing state should be updated using verified payment-provider events and appropriate server-side validation.

### 2.16 Callback Requests

Stores requests submitted by visitors through the public laboratory directory.

Potential fields:

- `id` — primary key
- `lab_id` — foreign key referencing `labs.id`
- `branch_id` — optional foreign key referencing `lab_branches.id`
- `requester_name`
- `requester_phone`
- `requester_email` — optional
- `consent_recorded_at`
- `callback_status`
- `assigned_to` — optional authorised staff reference
- `created_at`
- `resolved_at`

Callback requests should be visible only to authorised laboratory personnel and administrators with a legitimate operational need.

### 2.17 Audit Logs

Records important security-sensitive actions.

Potential fields:

- `id` — primary key
- `actor_user_id` — optional reference to `users.id`
- `action`
- `resource_type`
- `resource_id`
- `lab_id` — optional laboratory reference
- `created_at`
- `metadata` — limited, non-sensitive structured information

Audit events may include report uploads, report publication, patient-record linking, laboratory approvals, permission changes, and administrative actions.

Avoid storing passwords, OTP values, full report contents, or unnecessary patient information in audit metadata.

## 3. Planned Relationships

- One user may be linked to a patient profile.
- One user may have multiple explicitly authorised roles.
- One laboratory may have multiple branches.
- One laboratory may have multiple authorised staff members.
- One patient may have multiple laboratory-specific patient references.
- One patient may have multiple orders.
- One order belongs to a laboratory and may contain multiple order items.
- One order item refers to a diagnostic test.
- One order item may have multiple report versions.
- One laboratory may receive multiple callback requests.
- One laboratory may have subscription and payment records.
- One order may have multiple payment transactions.
- Important actions may generate audit-log entries.

Foreign keys, deletion rules, and uniqueness constraints will be defined during schema implementation.

## 4. Patient Identity and Record Linking

Patient-record linking is a core PublicLab requirement because records may originate from different participating laboratories.

The system should support:

- Controlled patient account claiming
- Verification of relevant contact channels
- Laboratory-specific patient identifiers
- Duplicate-record review
- Correction of incorrectly linked records
- Auditable record-linking and unlinking
- Authorised access to linked reports

An OTP confirms control of a communication channel, not a person's medical identity by itself. High-risk linking or disputed records may require additional verification and authorised review.

Records from different laboratories must not be merged automatically based only on matching names, email addresses, or phone numbers.

## 5. Indexing and Constraints

Potential indexes include:

- Unique normalized email addresses where account rules require them
- Foreign-key columns used for joins
- Laboratory approval status and searchable location fields
- Laboratory-specific patient identifiers
- Orders by patient, laboratory, status, and creation date
- Reports by patient, laboratory, order item, and publication status
- Subscription status and billing-period dates
- Payment-provider references
- Callback requests by laboratory, status, and creation date

Unique and compound indexes must reflect actual business rules. Do not impose globally unique patient contact numbers unless the identity model justifies that restriction.

Use database constraints to enforce required fields, valid relationships, and appropriate status values.

## 6. Transactions and Data Integrity

Use PostgreSQL transactions when multiple related changes must succeed or fail together.

Examples include:

- Creating an order and its order items
- Recording a verified payment and updating related payment state
- Publishing report metadata after successful file-storage operations
- Applying patient-record linking changes

Payment-provider events should be handled idempotently so that duplicate webhook deliveries do not create duplicate payment effects.

## 7. Data Security and Privacy

- Enforce authentication and authorisation in the backend.
- Restrict laboratory staff to explicitly authorised laboratory records.
- Keep reports in private object storage.
- Generate short-lived, authorised download links where appropriate.
- Store password hashes, never plaintext passwords.
- Protect OTP challenges and apply expiration and attempt limits.
- Keep database credentials, JWT secrets, and API keys in environment variables.
- Audit sensitive access and modifications.
- Minimise collected personal and medical information.
- Define retention, backup, deletion, and disaster-recovery policies.
- Apply rate limits to authentication, OTP, callback, and sensitive endpoints.
- Use encrypted connections where required by the deployment environment.

## 8. Implementation Status

This document describes the planned relational database design for PublicLab. It does not imply that the listed tables, constraints, or indexes already exist.

Actual SQL table definitions, migrations, constraints, indexes, and relationships must be documented as they are implemented and tested.
