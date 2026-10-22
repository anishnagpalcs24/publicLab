# PublicLab — AI Project Context

## 1. Project Overview

PublicLab is a multi-laboratory diagnostic platform that helps patients access their diagnostic test reports from participating laboratories in one place.

The platform will have three portals:

1. Users Portal — for patients and public visitors.
2. Lab Portal — for diagnostic laboratory owners and authorised staff.
3. Admin Portal — for the internal PublicLab team.

The project is being developed from scratch. Do not assume that previous project code, features, or architecture exist.

## 2. Main Business Goals

- Allow diagnostic laboratories to register and apply to join PublicLab.
- Require admin approval before a laboratory becomes publicly visible or can use restricted platform features.
- Let visitors search and discover approved laboratories without creating an account.
- Allow visitors to search by city, locality, laboratory name, and available services.
- Display laboratory locations, contact details, opening hours, and other approved information.
- Allow visitors to request a callback from a laboratory.
- Allow authorised laboratory staff to register patients and create diagnostic test orders.
- Allow laboratories to upload reports and publish them when ready.
- Allow patients to securely access their own reports and history across participating laboratories.
- Implement email verification, secure authentication, notifications, rate limiting, and access control.
- Introduce monthly or annual laboratory subscriptions in the future.
- Potentially support online payments and laboratory software integrations in later versions.

## 3. Technology Stack

Backend:
- Node.js
- Express.js
- JavaScript (CommonJS unless the project is deliberately migrated)
- MongoDB
- Mongoose

Other planned technologies:
- React.js for the frontend
- CSS for styling
- A transactional email provider
- Private object storage for report PDFs
- A suitable payment gateway for subscription payments

The developer knows JavaScript and is learning React. TypeScript is not currently part of the plan.

Prefer understandable, maintainable code and explain unfamiliar concepts. Do not introduce unnecessary frameworks or complex architecture.

## 4. Required Backend Folder Structure

Use this centralised folder structure. Do not replace it with a module-based directory structure unless explicitly requested.

backend/
├── src/
│   ├── config/
│   ├── models/
│   ├── controllers/
│   ├── routes/
│   ├── middleware/
│   ├── services/
│   ├── utils/
│   ├── app.js
│   └── server.js
├── .env
├── .env.example
├── .gitignore
├── package.json
└── package-lock.json

Responsibilities:

- config/: database, environment and external service configuration.
- models/: Mongoose schemas and database indexes.
- controllers/: HTTP request and response handling.
- routes/: API endpoint definitions.
- middleware/: authentication, authorisation, validation, rate limiting and error handling.
- services/: business logic, workflows and external integrations.
- utils/: reusable helpers and error-handling utilities.
- app.js: Express configuration and route registration.
- server.js: application startup and database connection.

Keep related files in their designated central folders.

## 5. Planned Business Models

Introduce models when their features are implemented. Likely models include:

- User
- Lab
- Patient
- Order
- Report
- Callback
- Subscription
- Payment

Model relationships must be designed carefully.

Important distinctions:

- A User is an account holder.
- A Patient is a person whose diagnostic records are maintained.
- A Lab represents an approved or pending diagnostic business.
- An Order represents a diagnostic testing transaction.
- A Report contains metadata and a secure reference to the actual report file.
- A Subscription represents a laboratory's paid platform plan.
- A Payment represents a financial transaction.

One patient may have many orders, orders may contain multiple tests, and reports may be published at different times.

Do not assume that two patient records belong to the same person solely because their names or phone numbers match.

## 6. Authentication and Authorisation

The platform must support distinct permissions for:

- Patients and public users
- Laboratory owners
- Laboratory staff
- PublicLab administrators

Authentication establishes who is making a request. Authorisation determines what that account may do.

Requirements:

- Secure registration, login, logout and account recovery.
- Email verification and appropriate OTP workflows.
- Secure password hashing.
- Server-side permission checks on protected API endpoints.
- Laboratory-level data isolation.
- Restricted administrative privileges.
- Session or token revocation where applicable.
- Rate limiting and abuse prevention.

Never rely only on frontend checks to protect sensitive data.

## 7. Patient Reports and Privacy

Diagnostic reports are sensitive personal information.

Requirements:

- Store report files in private object storage, not a publicly accessible directory.
- Store report metadata and relationships in MongoDB.
- Authorise every report view and download.
- Use short-lived access links where appropriate.
- Link records to patient accounts through a controlled identity-verification and claiming process.
- Maintain report status, publication history, and correction history.
- Record important access and modification events.
- Avoid exposing report contents in emails, logs, URLs, or error messages.
- Follow applicable Indian privacy and data-protection requirements.

An OTP verifies control of a communication channel; it does not by itself establish medical identity.

Use synthetic patient records during development and testing.

## 8. Laboratory Workflow

The intended workflow is:

1. Laboratory submits a registration application.
2. Email verification and required business-document checks are completed.
3. Admin reviews the application.
4. Admin approves, rejects, or requests additional information.
5. Approved laboratory manages its profile and authorised staff.
6. Staff registers a patient and creates a test order.
7. The lab records the applicable payment status.
8. Authorised personnel upload, review, and publish reports.
9. The patient receives a notification and securely accesses the report.

Only authorised laboratory personnel should be able to publish or correct diagnostic reports.

## 9. Payment Requirements

There are two distinct payment concepts:

1. Patient payments to diagnostic laboratories.
2. Laboratory subscription payments to PublicLab.

Keep these workflows separate.

Use verified payment-gateway webhooks for online payment confirmation. Handle duplicate webhook events safely and maintain a transaction record.

Do not trust frontend payment-success messages. Never store raw card details.

Online patient payments and marketplace settlements may be introduced later.

## 10. Development Rules for AI Assistants

Whenever assisting with PublicLab:

- Read this file first.
- Inspect the relevant existing code before proposing modifications.
- Preserve the agreed folder structure.
- Use JavaScript, not TypeScript.
- Use CommonJS unless the project configuration explicitly changes.
- Follow the existing coding conventions and installed package versions.
- Do not assume that a planned file or feature has already been implemented.
- Do not rewrite unrelated files or introduce unnecessary dependencies.
- Explain which file each code change belongs in.
- Provide complete, internally consistent code when a file needs to be created or replaced.
- Explain installation commands and environment variables when required.
- Identify security, validation, authorisation and error-handling requirements.
- Never request or reproduce real secrets from .env files.
- Never claim code has been tested unless it actually has been tested.
- If existing code conflicts with this document, inspect the code and explain the discrepancy before making substantial changes.
- Ask a clarifying question if a critical requirement is ambiguous.

## 11. Current Project Status

The project is at the initial backend setup stage.

The intended backend uses Node.js, Express.js, MongoDB and Mongoose.

The developer has selected the centralised folder structure in Section 4.

Do not assume that database connections, authentication, models, routes, controllers, email services, payments, or frontend applications are already complete.

Update this section as implementation progresses.

## 12. Long-Term Goal

Build a maintainable, secure, production-ready diagnostic laboratory platform with three portals, verified laboratory listings, controlled patient-report access, reliable notifications, subscriptions, and appropriate administrative oversight.
