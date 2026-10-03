# QueueSmart Build Roadmap

Each step is a feature that can be built, demoed and merged on its own. The
database tables for every step already exist in `server/prisma/schema.prisma`.

## Done

- [x] Project setup (React client, Express API, SQLite database via Prisma)
- [x] Register and log in with email and password
- [x] User and Administrator roles, with role-protected pages and API routes
- [x] Email verification (design only: the link is printed in the server console)

## A2: Front end with mock data

The A2 screens follow the design prototype and run entirely in the browser on demo
data. Login still uses the real API.

- `client/src/mockData.js`: seed data (services, queues, Hao's ticket IT-024, history, updates)
- `client/src/queueLogic.js`: queue rules and the simulation, with a simulated clock
- `client/src/QueueContext.jsx`: one shared store (`useQueues()`), saved in localStorage and synced across tabs

Done:

- [x] Sign in / Create account with inline validation
- [x] App shell: header, nav, phone tab bar, footer with Reset demo, light/dark theme
- [x] User: Overview (ticket + "While you wait" timeline + services), Services, service detail/join, My ticket (leave, served + confetti)
- [x] Admin: Overview (open/close queues, priority sorting, open/closed sections), Waiting lists (serve next, reorder, remove)
- [x] Confirmation dialogs, toasts, empty states
- [x] Admin service management (service list, create/edit form, metadata, open/close, delete)
- [x] Admin visit completion (problem, outcome, notes) and service-grouped visit history
- [x] In-app notifications with unread badges, mark-read, and clear-history controls
- [x] Waiting-list drag-and-drop reordering with arrow-button fallback

The current front end remains a browser-local simulation after sign-in. The service and queue screens below describe the planned server-backed version.

## 1. Service management (admin)

API: `server/src/routes/services.js`, mounted at `/api/services`

- `GET /api/services` for any logged-in user, listing open services
- `POST /api/services` for admins only, creating a service (name, description, expectedDuration, priority)
- `PUT /api/services/:id` for admins only, editing a service or opening/closing it
- Protect admin routes with `requireAuth, requireRole('ADMIN')` from `middleware/auth.js`

Client demo: a service list plus a responsive create/edit form on the Admin dashboard. The form validates required fields, numeric values, and text lengths; category automatically chooses the service icon.

## 2. Queue management

API: `server/src/routes/queues.js`

- `POST /api/queues/:serviceId/join` creates a `QueueEntry` with status `WAITING`. Reject the request if the user is already waiting in that queue.
- `POST /api/queues/:serviceId/leave` sets the status to `LEFT` and stamps `completedAt`.
- `GET /api/queues/me` returns the user's active entries with their position and estimated wait.
- `GET /api/queues/:serviceId` (admin) returns the ordered list of waiting users.
- `POST /api/queues/:serviceId/serve-next` (admin) marks the current `SERVING` entry as `SERVED`, then moves the next `WAITING` entry to `SERVING`.

**Ordering rule:** sort by priority (HIGH, then MEDIUM, then LOW), then by `joinedAt`, oldest first.

**Estimated wait:** people ahead × `service.expectedDuration`. A later improvement is to use the average of real service times (`completedAt - servedAt`) from recent `SERVED` entries.

Client demo: users can join or leave queues and see their position and wait time. Admins can serve the next visitor through a completion form, record a problem/outcome/notes, drag visitors to new positions, or use the arrow controls. A real server version should poll every 10–15 seconds so numbers stay current.

## 3. Notifications

- Build a helper `notify(userId, message)` that creates a `Notification` row.
- Call it after every serve-next for anyone who is now position 1–2 ("You're almost up"), and whenever someone's status changes.
- `GET /api/notifications` and `POST /api/notifications/:id/read`
- Client demo: a bell icon with an unread count, a notification history page, individual mark-as-read controls, and clear-history confirmation. Queue updates and status changes are displayed in-app only.
- Optional: send a real email too (Nodemailer + Mailtrap for testing).

## 4. History and statistics

- `GET /api/history` returns the user's own past `QueueEntry` rows.
- `GET /api/stats` (admin) returns, per service: people served today, average wait (`servedAt - joinedAt`), the busiest hours, and the number of people who left.
- Client demo: users have personal history; admins have visit history grouped by service, with visitor, ticket, problem, outcome, notes, and edit controls. Server-backed statistics remain planned.

## Team workflow

- Create one GitHub issue per feature above and put them on a GitHub Projects board.
- Work on a branch per feature and open a pull request. Get one review before merging to `main`.
