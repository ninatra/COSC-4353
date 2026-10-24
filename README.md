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

**Requirements:** Node.js 20 or newer.

```bash
# 1. Install dependencies for the client and server
npm install

# 2. Create your local settings file
cp server/.env.example server/.env

# 3. Create the database and load demo data
npm run setup

# 4. Start the API (port 4000) and the web app (port 5173) together
npm run dev
```

Open http://localhost:5173 and log in with a demo account (password `password123`):

| Role          | Email                |
| ------------- | -------------------- |
| Administrator | admin@queuesmart.dev |
| User          | user@queuesmart.dev  |

To register a new administrator, use the admin code set in `ADMIN_SIGNUP_CODE` in `server/.env`.
Email verification links are printed in the server console instead of being emailed.

Useful commands:

- `npm run db:studio -w server` opens a browser UI for viewing and editing the database.
- `cd server` then `node --env-file=.env prisma/seed.js --reset-queues` restores sample queues while preserving services, accounts, and history. Previous active entries become Left records.
- Demo services, visitors, and past visits are defined in `server/prisma/seed.js`; restarting the app preserves database changes.

## Front End (A2)

- **Stack:** React + Vite with plain CSS (styles in `client/src/styles/`, imported by `client/src/index.css`, with light and dark themes) and lucide-react icons. React gives us reusable components for the ticket, service cards and dialogs; Vite keeps development fast; plain CSS with custom properties keeps the design system in one place without a UI kit.
- **Backend integration:** services, queues, notifications and history all come from the API. Queue changes refresh immediately; other devices refresh every 10 seconds.
- **Wait estimate:** people ahead × the service's expected visit length. This is a deliberate simplification for the demo.
- **In-app notifications:** users receive join confirmation, Almost ready at position 2, You’re next at position 1, and served/left/removed notices. Admin bell alerts cover first visitors and full queues; routine joins appear in activity history. No email/SMS is sent.
- **Queue management:** admins complete visits with an outcome and optional issue/notes, reorder with drag-and-drop or arrows, and remove visitors with an optional reason. Manual order takes precedence over ticket priority and arrival time; new visitors append after manual reordering.
- **History:** admins browse 15 visits per page, defaulting to Today, with service tabs, date range, status, and student/ticket search. All entries support editing; left/removed visits allow notes only.

## Back End (A3)

- **Stack:** Node.js with Express 5 (REST API), Prisma with SQLite, bcryptjs for password hashing and JWT for login sessions. Tests use Node's built-in test runner.
- **Modules:** authentication (`/api/auth`), service management (`/api/services`), queue management with wait-time estimates (`/api/queues`), notifications (`/api/notifications`) and history (`/api/history`). Business rules live in `server/src/logic/`; input validation lives in `server/src/validation/`.
- **Tests:** `npm test -w server` runs unit tests for the rules and validation, plus route tests against a throwaway test database. `npm run test:coverage -w server` prints coverage for loaded server source modules; review included files before claiming overall coverage.

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
