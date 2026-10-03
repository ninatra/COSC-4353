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
- Record visit problems, outcomes, and notes when serving a visitor
- Review visit history organized by service
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

Administrators can create and maintain services, manage active queues, monitor queue activity, and oversee the users waiting for service. They can open or close queues, reorder visitors, remove visitors, and complete visits with a problem description, outcome, and optional notes. Visit history is organized by service and can be edited after the visit.

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
- To reset the database, delete `server/prisma/dev.db` and run `npm run setup`.

## Front End (A2)

- **Stack:** React + Vite with plain CSS (design tokens in `client/src/index.css`, light and dark themes) and lucide-react icons. React gives us reusable components for the ticket, service cards and dialogs; Vite keeps development fast; plain CSS with custom properties keeps the design system in one place without a UI kit.
- **Mock data and simulation:** queue data is sample data kept in the browser (localStorage), not the server. A simulated clock starts at 10:05 AM and moves forward a few minutes with each action. Joining, leaving, serving, reordering and removing all update every screen and write to Updates.
- **Wait estimate:** people ahead × the service's expected visit length. This is a deliberate simplification for the demo.
- **In-app notifications:** the bell and Notifications page display queue updates and status changes. Notifications are intentionally in-app only for this assignment; service configuration changes and queue reordering are not treated as alerts.
- **Visit completion:** administrators record a required problem, an outcome (Completed, Referred elsewhere, Unresolved, or Follow-up needed), and optional notes before a visitor is removed from the active queue.
- **Sign in** uses the real API and database; everything after sign-in uses the mock data. Use **Reset demo** in the footer to restore the sample data.

## Project Structure

```
client/   React web app (Vite)
  src/pages/        One file per screen (user and admin)
  src/components/   Shared UI: app shell, ticket, service cards, dialogs
  src/AuthContext   Keeps track of the logged-in user
  src/QueueContext  Shared mock queue data for the A2 screens
server/   Express REST API
  prisma/           Database schema and demo data
  src/routes/       API endpoints (/api/auth, ...)
  src/middleware/   Login and role checks
docs/     Design documents and the build roadmap
```

See [docs/ROADMAP.md](docs/ROADMAP.md) for the features still to build.

## Project Goal

The goal of QueueSmart is to improve the queue experience for both customers and service providers. By moving queue management to a mobile and web platform, the application helps reduce congestion, improves visibility into wait times, and gives administrators better control over their services.
