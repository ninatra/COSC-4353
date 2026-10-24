# QueueSmart Build Roadmap

## Implemented

- React/Vite frontend, Express API, and SQLite through Prisma.
- Registration/login with password hashing, JWT sessions, user/admin roles, and validation.
- Email verification links printed in the server console (no email delivery).
- Service creation, editing, listing, opening/closing, and deletion through the API, including service metadata.
- User queue join/leave and admin waiting lists, serve-next, drag-and-drop/arrow reordering, and removal with optional notes/reason.
- Basic wait estimates: people ahead × expected visit duration.
- Backend notifications and history connected to the frontend.
- Unit tests for business rules/validation and API tests using isolated test databases.

## Service management

Routes in `server/src/routes/services.js`:

- `GET /api/services`: catalog for logged-in users.
- `POST /api/services`, `PUT /api/services/:id`, `DELETE /api/services/:id`: admin only.
- Service fields include name, description, expected duration, priority, open/closed state, location, contact, hours, category, capacity, and instructions.
- Category determines the displayed service icon. Services with queue history cannot be deleted.

## Queue management

Routes in `server/src/routes/queues.js`:

- `POST /api/queues/:serviceId/join`, `POST /api/queues/:serviceId/leave`: user actions.
- `GET /api/queues`: shared queue snapshot; other visitors’ identities are hidden from non-admins.
- `GET /api/queues/me`: active ticket, position, and estimated wait.
- `GET /api/queues/:serviceId`: admin waiting list.
- `POST /api/queues/:serviceId/serve-next`: admin completes the next visit with an outcome and optional issue/notes.
- `PUT /api/queues/:serviceId/reorder`: admin saves manual queue order; stale requests are rejected.
- `DELETE /api/queues/:serviceId/entries/:entryId`: admin removes a visitor with optional notes/reason. History records the result as Removed.

Manual order takes precedence over ticket priority, then arrival time. Standard joins receive MEDIUM priority. New visitors append after manually ordered visitors. Service priority is a separate admin sorting label. Users can hold only one active place, and cannot join closed/full queues.

Screens refresh after actions and poll every 10 seconds. Tickets use stored service-prefixed IDs such as AA-002 and IT-003.

## Notifications

Rules in `server/src/logic/notifications.js`, saved by queue routes:

- Users: Ticket confirmed on joining, Almost ready at position 2, You’re next at position 1, and served/left/removed notices.
- Almost ready and You’re next are separate alerts, each sent once per visit.
- Admin bell: first visitor in an empty queue and queue reaching capacity. Routine joins appear on the Notifications page without increasing the bell count.
- Admin actions show confirmation toasts. No email/SMS delivery.
- `GET /api/notifications`, `PATCH /api/notifications/:id/read`, `PATCH /api/notifications/read-all`, `DELETE /api/notifications`.

## History

Routes in `server/src/routes/history.js`:

- `GET /api/history`: finished visits, scoped to the user or all visits for admins.
- Admin history uses backend filters and pagination: service, date range (Today by default), status, student/ticket search, and 15 visits per page.
- The table includes issue, outcome, and notes. Blank issues/notes display a dash.
- `PUT /api/history/:id`: admin edits served visit issues/outcomes/notes; left/removed visits allow notes-only editing with the result preserved.
- Sample past visits have varied dates and outcomes. Queue resets preserve prior entries as Left, so reset-generated records also appear in history.

## Styling and demo data

- `client/src/index.css` imports four files in `client/src/styles/`: `foundation.css`, `pages.css`, `forms.css`, and `responsive.css`.
- Light/dark themes, responsive layouts, confirmation dialogs, toasts, and empty states are implemented.
- `server/prisma/seed.js` provides demo accounts, services, queue visitors, and history. Normal seeding avoids duplicating sample records.
- Explicit queue restoration: from `server/`, run `node --env-file=.env prisma/seed.js --reset-queues`. The old browser-only Reset demo footer has been removed.

## Remaining / optional

- Admin statistics endpoint and charts.
- Optional email delivery.
- Review coverage reports for the assignment’s overall target; do not infer whole-backend coverage from a subset of loaded modules.

## Team workflow

Create feature issues, work on branches, and request a review before merging to main.
