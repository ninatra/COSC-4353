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

Services and queues now use the backend. History and notification screens still use browser-local demo data.

## 1. Service management (admin)

API: `server/src/routes/services.js`, mounted at `/api/services`

Backend implemented: authenticated catalog listing for both roles (including closed services), admin-only creation and partial updates including open/close, input
validation, and direct unit tests for validation and service IDs. Frontend service listing, creation, editing, open/close, and deletion now use the API. Overall backend coverage remains to be assessed
as tests for authentication, route handlers, and queue logic are added.

- `GET /api/services` for any logged-in user, listing the service catalog
- `POST /api/services` for admins only, creating a service (name, description, expectedDuration, priority)
- `PUT /api/services/:id` for admins only, editing a service or opening/closing it
- Protect admin routes with `requireAuth, requireRole('ADMIN')` from `middleware/auth.js`

Client demo: a service list plus a responsive create/edit form on the Admin dashboard. The form validates required fields, numeric values, and text lengths; category automatically chooses the service icon.

## 2. Queue management

API: `server/src/routes/queues.js`

- `POST /api/queues/:serviceId/join` creates a `WAITING` entry. Reject closed/full services or any existing active entry for that user.
- `POST /api/queues/:serviceId/leave` sets the status to `LEFT` and stamps `completedAt`.
- `GET /api/queues` returns queue snapshots with other users' identities hidden from non-admins.
- `GET /api/queues/me` returns the user's active entry with position and estimated wait.
- `GET /api/queues/:serviceId` (admin) returns the ordered list of waiting users.
- `POST /api/queues/:serviceId/serve-next` (admin) completes the next visitor as `SERVED`, storing optional problem/notes and the outcome.

**Ordering rule:** sort by priority (HIGH, then MEDIUM, then LOW), then by `joinedAt`, oldest first.

**Estimated wait:** people ahead × `service.expectedDuration`. A later improvement is to use the average of real service times (`completedAt - servedAt`) from recent `SERVED` entries.

Implemented: API-backed join/leave, admin queue viewing and completion, transactional writes, queue-rule unit tests, and polling every 10 seconds. Standard joins use MEDIUM priority; users cannot choose their own priority. Admin reordering is saved through `PUT /api/queues/:serviceId/reorder`; manual order takes precedence and new visitors append. Drag-and-drop and arrow controls are available. Visitor removal remains pending.

## 3. Notifications

Done. Rules in `server/src/logic/notifications.js`, saved as `Notification` rows by the queue routes:

- Joining: the visitor gets "Ticket confirmed" (position and wait); admins get "Visitor joined", plus "First visitor waiting" and "Queue at capacity" when they apply.
- Reaching position 1 or 2 (after a join, leave, serve or reorder): one "Almost ready" notice per visit.
- Served and left: a notice to the visitor.
- `GET /api/notifications`, `PATCH /api/notifications/:id/read`, `PATCH /api/notifications/read-all`, `DELETE /api/notifications`
- The bell, Notifications page and "While you wait" read from this API. In-app only; nothing is emailed.
- Optional later: send a real email too (Nodemailer + Mailtrap for testing).

## 4. History and statistics

- Done: `GET /api/history` returns finished visits (served, left, removed): the user's own, or every visit for admins. `PUT /api/history/:id` (admin) edits a served visit's outcome, problem and notes. Rows are built in `server/src/logic/history.js`.
- Still to do: `GET /api/stats` (admin) returns, per service: people served today, average wait (`servedAt - joinedAt`), the busiest hours, and the number of people who left.
- Users see personal history; admins see visit history grouped by service, with edit controls. Both come from the API.

## Team workflow

- Create one GitHub issue per feature above and put them on a GitHub Projects board.
- Work on a branch per feature and open a pull request. Get one review before merging to `main`.
