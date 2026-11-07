# QueueSmart

QueueSmart is a mobile and web application that makes waiting in line more convenient and organized. Instead of standing in a physical queue, users can find a service, join its queue digitally, and monitor their progress from their device. The application provides users with their current position and an estimated wait time so they can better plan their time while they wait.

QueueSmart also gives administrators the tools they need to organize their services and manage active queues. Administrators can create services, monitor the users waiting for each service, and keep track of queue activity from a centralized interface.

## Features

- Join available service queues
- View queue position and estimated wait time
- Track queue progress and receive status updates
- Receive in-app notifications for queue updates and status changes
- Leave a queue when service is no longer needed
- Browse service details including location, hours, contact information, category, capacity, and instructions
- Create, edit, open, close, and delete services as an administrator
- Monitor active queues and reorder waiting visitors with buttons or drag and drop
- Record visit issues, outcomes, and notes when serving a visitor
- Search and filter visit history by service, date, and status, with pagination
- Organize and oversee service activity from one place

## How It Works

1. A user opens QueueSmart and browses the available services.
2. The user selects a service and joins its queue.
3. QueueSmart displays the user's position and estimated wait time.
4. The user monitors the queue as other users are served.
5. Administrators manage the queue and update its progress as service is provided.

This process reduces unnecessary physical waiting and gives both users and administrators a clearer view of queue activity.

## User Roles

### Users

Users can browse available services, join a queue, and track their position and estimated wait time. They can use the application to stay informed about queue progress without having to remain in a physical line.

### Administrators

Administrators can create and maintain services, manage active queues, monitor queue activity, and oversee the users waiting for service. They can open or close queues, reorder visitors, remove visitors, and complete visits with an outcome and optional issue/notes. Admin history supports service and date filters, search, status filters, and pagination. Served visit details can be edited; left and removed visits allow notes-only edits.

## Getting Started

**Requirements:** Node.js 22 or newer (also used by CI and the coverage gate).

```bash
# 1. Install dependencies for the client and server
npm install

# 2. Create your local settings file
cp server/.env.example server/.env

# 3. Create/update the database and install validation constraints
npm run setup

# 4. Start the API (port 4000) and the web app (port 5173) together
npm run dev
```

Open http://localhost:5173 and sign in with an existing account or register a new one. Setup and startup preserve existing records and do not add sample students or reset queues.

For a separate demo database, optionally run `npm run db:seed -w server` to create sample accounts and queue data. The sample accounts use password `password123`:

| Role | Email |
| --- | --- |
| Administrator | admin@queuesmart.dev |
| User | user@queuesmart.dev |

To register a new administrator, use the admin code set in `ADMIN_SIGNUP_CODE` in `server/.env`.
Email verification links are printed in the server console instead of being emailed.

Useful commands:

- `npm run db:studio -w server` opens a browser UI for viewing and editing the database.

- Optional sample services, visitors, and past visits are defined in `server/prisma/seed.js`. Seeding is not part of normal setup or startup.
- `cd server` then `node --env-file=.env prisma/seed.js --reset-queues` restores sample queues while preserving accounts, services, and history.

## Front End (A2)

- **Stack:** React + Vite with plain CSS (styles in `client/src/styles/`, imported by `client/src/index.css`, with light and dark themes) and lucide-react icons. React gives us reusable components for the ticket, service cards and dialogs; Vite keeps development fast; plain CSS with custom properties keeps the design system in one place without a UI kit.
- **Backend integration:** services, queues, notifications and history all come from the API. Queue changes refresh immediately; other devices refresh every 10 seconds.
- **Form submissions and persistence:** registration/login and profile forms call `/api/auth` and `/api/profile`; service forms call `/api/services`; queue completion/removal forms call `/api/queues`; history edits call `/api/history`. The API writes through Prisma to SQLite before confirming success. Reloads fetch saved records from the API; business records are not loaded from demo data or browser storage. Notification read/clear changes are also saved through the API, and failed saves display an error.
- **Wait estimate:** people ahead × the service's expected visit length. This is a deliberate simplification for the demo.
- **In-app notifications:** users receive join confirmation, Almost ready at position 2, You’re next at position 1, and served/left/removed notices. Admin bell alerts cover first visitors and full queues; routine joins appear in activity history. No email/SMS is sent.
- **Repeat alerts:** moving from position 3 or farther back to 2 sends Almost ready again; moving from position 2 or farther back to 1 sends You’re next again. Unchanged positions and backward moves do not trigger alerts. Profile notification preferences still apply.
- **Queue management:** admins complete visits with an outcome and optional issue/notes, reorder with drag-and-drop or arrows, and remove visitors with an optional reason. Manual order takes precedence over ticket priority and arrival time; new visitors append after manual reordering.
- **History:** admins browse 15 visits per page, defaulting to All dates, with service tabs, date range, status, outcome, and student/ticket search. All entries support editing; left/removed visits allow notes only.

## Back End (A3)

- **Stack:** Node.js with Express 5 (REST API), Prisma with SQLite, bcryptjs for password hashing and JWT for login sessions. Tests use Node's built-in test runner.
- **Modules:** authentication (`/api/auth`), service management (`/api/services`), queue management with wait-time estimates (`/api/queues`), notifications (`/api/notifications`) and history (`/api/history`). Business rules live in `server/src/logic/`; input validation lives in `server/src/validation/`.
- **Tests:** `npm test -w server` runs unit, API, raw-SQL validation, migration/backup/rollback, seed, and process-restart persistence tests against isolated databases. `npm run test:coverage -w server` includes both `server/src/**/*.js` and `server/prisma/**/*.js` and fails if aggregate line, branch, or function coverage falls below **80%**. The existing GitHub Actions workflow runs this coverage gate on pull requests and pushes to main.
- **Persistence test:** `cd server` then `node --test test/persistence.test.js` verifies registration, profile/email changes, service edits, queue tickets, history, and notification changes remain retrievable across separate requests and API process restarts, using an isolated SQLite database.

## Database (A4)

- **Database:** SQLite, accessed through Prisma. The schema is in `server/prisma/schema.prisma`; `npm run db:sql -w server` writes the matching `CREATE TABLE` statements (primary keys, foreign keys, unique constraints) to `server/prisma/schema.sql`.
- **Users:** `UserCredentials` holds the login (email as the unique username, bcrypt password hash, role). `UserProfile` holds the full name, optional phone and the "almost ready" alert preference, linked to the login by email. Both are created together at registration; users edit their profile on the Profile page.
- **Notifications:** each notice has a status of `SENT` or `VIEWED`.
- **Queues:** each service has one `Queue` with `OPEN`/`CLOSED` status and a created date. `QueueEntry` links a visitor to that queue, stores their 1-based position while waiting, and uses `WAITING`, `SERVED`, or `CANCELED` status. Positions update after reordering and departures.
- **History:** finished entries have a separate `History` record for completion/served times, outcome, problem, and notes. History also distinguishes voluntary departures from admin removals. Entries retain their ticket IDs; their position becomes null when finished.
- **Validation:** API validators enforce required fields, types, formats, and lengths before writing. SQLite triggers enforce required nonblank text, field lengths, integer ranges, booleans, dates, and allowed statuses for inserts and updates, including direct SQL. Unique email indexes and foreign keys protect account identity and relations. Passwords accept 8–72 characters with a maximum of 72 UTF-8 bytes before bcrypt hashing.
- **Installing database validation:** `npm run setup` installs it automatically. For an existing database, run `npm run db:constraints -w server`. This checks existing records first and reports invalid data without changing it. After a manual `prisma db push`, rerun that command because a table rebuild can remove triggers. `schema.sql` and the validation migration also include these constraints.
- **Upgrading the previous combined queue schema:** stop the app, run `npm run db:upgrade-queues -w server`, then `npx prisma generate --schema server/prisma/schema.prisma` and restart. The upgrade saves a backup and preserves existing accounts, queues, and visits. New databases use `npm run setup`.

## Project Structure

```
client/   React web app (Vite)
  src/pages/        One file per screen (user and admin)
  src/components/   Shared UI: app shell, ticket, service cards, dialogs
  src/styles/       Foundation, page, form, and responsive styles
  src/AuthContext   Keeps track of the logged-in user
  src/QueueContext  Shared API-backed service/queue state
server/   Express REST API
  prisma/           Database schema and demo data
  src/routes/       API endpoints (auth, services, queues, notifications, history)
  src/logic/        Queue, notification and history rules
  src/validation/   Input checks for each module
  test/             Unit and route tests
  src/middleware/   Login and role checks
docs/     Design documents and the build roadmap
```

See [docs/ROADMAP.md](docs/ROADMAP.md) for the features still to build.

## Project Goal

The goal of QueueSmart is to improve the queue experience for both customers and service providers. By moving queue management to a mobile and web platform, the application helps reduce congestion, improves visibility into wait times, and gives administrators better control over their services.
