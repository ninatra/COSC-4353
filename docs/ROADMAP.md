# QueueSmart Build Roadmap

Each step is a feature that can be built, demoed and merged on its own. The
database tables for every step already exist in `server/prisma/schema.prisma`.

## Done

- [x] Project setup (React client, Express API, SQLite database via Prisma)
- [x] Register and log in with email and password
- [x] User and Administrator roles, with role-protected pages and API routes
- [x] Email verification (design only: the link is printed in the server console)

## 1. Service management (admin)

API: `server/src/routes/services.js`, mounted at `/api/services`

- `GET /api/services` for any logged-in user, listing open services
- `POST /api/services` for admins only, creating a service (name, description, expectedDuration, priority)
- `PUT /api/services/:id` for admins only, editing a service or opening/closing it
- Protect admin routes with `requireAuth, requireRole('ADMIN')` from `middleware/auth.js`

Client: a service list plus a create/edit form on the Admin dashboard.

## 2. Queue management

API: `server/src/routes/queues.js`

- `POST /api/queues/:serviceId/join` creates a `QueueEntry` with status `WAITING`. Reject the request if the user is already waiting in that queue.
- `POST /api/queues/:serviceId/leave` sets the status to `LEFT` and stamps `completedAt`.
- `GET /api/queues/me` returns the user's active entries with their position and estimated wait.
- `GET /api/queues/:serviceId` (admin) returns the ordered list of waiting users.
- `POST /api/queues/:serviceId/serve-next` (admin) marks the current `SERVING` entry as `SERVED`, then moves the next `WAITING` entry to `SERVING`.

**Ordering rule:** sort by priority (HIGH, then MEDIUM, then LOW), then by `joinedAt`, oldest first.

**Estimated wait:** people ahead × `service.expectedDuration`. A later improvement is to use the average of real service times (`completedAt - servedAt`) from recent `SERVED` entries.

Client: a user dashboard where users can join or leave queues and see their position and wait time. Poll every 10–15 seconds so the numbers stay current.

## 3. Notifications

- Build a helper `notify(userId, message)` that creates a `Notification` row.
- Call it after every serve-next for anyone who is now position 1–2 ("You're almost up"), and whenever someone's status changes.
- `GET /api/notifications` and `POST /api/notifications/:id/read`
- Client: a bell icon with an unread count.
- Optional: send a real email too (Nodemailer + Mailtrap for testing).

## 4. History and statistics

- `GET /api/history` returns the user's own past `QueueEntry` rows.
- `GET /api/stats` (admin) returns, per service: people served today, average wait (`servedAt - joinedAt`), the busiest hours, and the number of people who left.
- Client: a history table for users and a stats page for admins.

## Team workflow

- Create one GitHub issue per feature above and put them on a GitHub Projects board.
- Work on a branch per feature and open a pull request. Get one review before merging to `main`.
