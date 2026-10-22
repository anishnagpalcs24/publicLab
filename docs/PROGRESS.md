# PublicLab Development Progress

## Project Status

**Current stage:** Initial backend setup and documentation.

**Backend stack:** Node.js, Express.js, MongoDB, Mongoose and JavaScript.

**Architecture:** Centralised MVC-style folder structure.

## Completed

- [x] Defined the three portals: Users, Lab and Admin.
- [x] Established the initial technology stack.
- [x] Selected the centralised backend folder structure.
- [x] Created the project context documentation.
- [x] Drafted initial API documentation.
- [x] Drafted initial database design documentation.
- [x] Created the development progress document.

## In Progress

- [ ] Verify backend dependencies and scripts.
- [ ] Configure environment variables.
- [ ] Implement the MongoDB connection.
- [ ] Implement the Express application and server startup.
- [ ] Add a health-check endpoint.

## Planned Milestones

### Milestone 1: Backend Foundation
- Configure the server and database.
- Implement environment validation.
- Add request validation and centralised error handling.
- Add a basic health endpoint.

### Milestone 2: Laboratory Registration
- Create the Lab model.
- Implement laboratory registration and validation.
- Add email verification.
- Implement admin approval, rejection and review workflows.
- Add permission checks.

### Milestone 3: Public Lab Discovery
- Add searchable approved laboratory listings.
- Add public laboratory profiles.
- Add callback request management.

### Milestone 4: Lab Operations
- Add staff permissions.
- Implement patient registration.
- Implement test orders and payment-status tracking.
- Implement private report uploads and publication workflows.

### Milestone 5: Patient Portal
- Implement secure patient registration and account recovery.
- Add the controlled report-claiming process.
- Add report history and secure downloads.
- Add report-ready notifications.

### Milestone 6: Administration and Billing
- Add administrative management tools.
- Implement subscriptions and invoices.
- Integrate and verify payment gateway webhooks.

### Milestone 7: Testing and Deployment
- Add unit and integration tests.
- Test authorisation boundaries and cross-lab isolation.
- Test report access and patient identity linking.
- Configure monitoring, backups and recovery.
- Complete security and privacy reviews before production launch.

## Known Issues

No issues documented yet. Update this section when issues are identified.

## Current Task

Complete the initial backend setup and verify that the Express server can connect to MongoDB.

## Next Task

Create the database connection, application entry point, server entry point, and health-check endpoint.

## Update Rules

- Mark a task complete only after verifying it.
- Record important implementation decisions.
- Document known bugs and their status.
- Update API and database documentation when implementation changes.
- Never place secrets or real patient data in this document.
