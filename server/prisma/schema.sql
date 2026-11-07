-- CreateTable
CREATE TABLE "UserCredentials" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "verificationToken" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "UserProfile" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "almostReadyAlerts" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserProfile_email_fkey" FOREIGN KEY ("email") REFERENCES "UserCredentials" ("email") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Service" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "expectedDuration" INTEGER NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "location" TEXT,
    "contact" TEXT,
    "hours" TEXT,
    "category" TEXT NOT NULL DEFAULT 'Other',
    "maxCapacity" INTEGER,
    "instructions" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Queue" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "serviceId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Queue_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QueueEntry" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "queueId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "position" INTEGER,
    "ticketId" TEXT,
    "initialPosition" INTEGER,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    CONSTRAINT "QueueEntry_queueId_fkey" FOREIGN KEY ("queueId") REFERENCES "Queue" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QueueEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserCredentials" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "History" (
    "entryId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "status" TEXT NOT NULL,
    "servedAt" DATETIME,
    "completedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "problem" TEXT NOT NULL DEFAULT '',
    "outcome" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "History_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "QueueEntry" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'info',
    "title" TEXT NOT NULL DEFAULT '',
    "message" TEXT NOT NULL,
    "serviceId" INTEGER,
    "ticketId" TEXT,
    "entryId" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserCredentials" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "UserCredentials_email_key" ON "UserCredentials"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UserCredentials_verificationToken_key" ON "UserCredentials"("verificationToken");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_email_key" ON "UserProfile"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Queue_serviceId_key" ON "Queue"("serviceId");

-- CreateIndex
CREATE INDEX "QueueEntry_queueId_status_position_idx" ON "QueueEntry"("queueId", "status", "position");

-- CreateIndex
CREATE INDEX "QueueEntry_userId_idx" ON "QueueEntry"("userId");

-- CreateIndex
CREATE INDEX "History_completedAt_idx" ON "History"("completedAt");

-- CreateIndex
CREATE INDEX "Notification_userId_status_idx" ON "Notification"("userId", "status");

DROP TRIGGER IF EXISTS "validate_UserCredentials_insert";

CREATE TRIGGER "validate_UserCredentials_insert" BEFORE INSERT ON "UserCredentials" BEGIN
SELECT CASE WHEN (typeof(NEW."email") = 'text' AND length(NEW."email") <= 254 AND length(trim(NEW."email", char(9)||char(10)||char(13)||' ')) > 0 AND NEW."email" = lower(trim(NEW."email")) AND NEW."email" GLOB '?*@?*.??*'
  AND length(NEW."email")-length(replace(NEW."email",'@',''))=1
  AND instr(NEW."email",' ')=0 AND instr(NEW."email",char(9))=0 AND instr(NEW."email",char(10))=0 AND instr(NEW."email",char(13))=0) IS NOT TRUE THEN RAISE(ABORT, 'Validation: UserCredentials.email') END;
SELECT CASE WHEN (typeof(NEW."passwordHash") = 'text' AND length(NEW."passwordHash") <= 255 AND length(trim(NEW."passwordHash", char(9)||char(10)||char(13)||' ')) > 0) IS NOT TRUE THEN RAISE(ABORT, 'Validation: UserCredentials.passwordHash') END;
SELECT CASE WHEN (typeof(NEW."role") = 'text' AND NEW."role" IN ('USER','ADMIN')) IS NOT TRUE THEN RAISE(ABORT, 'Validation: UserCredentials.role') END;
SELECT CASE WHEN (typeof(NEW."emailVerified") = 'integer' AND NEW."emailVerified" IN (0,1)) IS NOT TRUE THEN RAISE(ABORT, 'Validation: UserCredentials.emailVerified') END;
SELECT CASE WHEN (NEW."verificationToken" IS NULL OR (typeof(NEW."verificationToken") = 'text' AND length(NEW."verificationToken") <= 128 AND length(trim(NEW."verificationToken", char(9)||char(10)||char(13)||' ')) > 0)) IS NOT TRUE THEN RAISE(ABORT, 'Validation: UserCredentials.verificationToken') END;
SELECT CASE WHEN ((typeof(NEW."createdAt") = 'integer' OR (typeof(NEW."createdAt") = 'text' AND julianday(NEW."createdAt") IS NOT NULL))) IS NOT TRUE THEN RAISE(ABORT, 'Validation: UserCredentials.createdAt') END;
END;

DROP TRIGGER IF EXISTS "validate_UserCredentials_update";

CREATE TRIGGER "validate_UserCredentials_update" BEFORE UPDATE ON "UserCredentials" BEGIN
SELECT CASE WHEN (typeof(NEW."email") = 'text' AND length(NEW."email") <= 254 AND length(trim(NEW."email", char(9)||char(10)||char(13)||' ')) > 0 AND NEW."email" = lower(trim(NEW."email")) AND NEW."email" GLOB '?*@?*.??*'
  AND length(NEW."email")-length(replace(NEW."email",'@',''))=1
  AND instr(NEW."email",' ')=0 AND instr(NEW."email",char(9))=0 AND instr(NEW."email",char(10))=0 AND instr(NEW."email",char(13))=0) IS NOT TRUE THEN RAISE(ABORT, 'Validation: UserCredentials.email') END;
SELECT CASE WHEN (typeof(NEW."passwordHash") = 'text' AND length(NEW."passwordHash") <= 255 AND length(trim(NEW."passwordHash", char(9)||char(10)||char(13)||' ')) > 0) IS NOT TRUE THEN RAISE(ABORT, 'Validation: UserCredentials.passwordHash') END;
SELECT CASE WHEN (typeof(NEW."role") = 'text' AND NEW."role" IN ('USER','ADMIN')) IS NOT TRUE THEN RAISE(ABORT, 'Validation: UserCredentials.role') END;
SELECT CASE WHEN (typeof(NEW."emailVerified") = 'integer' AND NEW."emailVerified" IN (0,1)) IS NOT TRUE THEN RAISE(ABORT, 'Validation: UserCredentials.emailVerified') END;
SELECT CASE WHEN (NEW."verificationToken" IS NULL OR (typeof(NEW."verificationToken") = 'text' AND length(NEW."verificationToken") <= 128 AND length(trim(NEW."verificationToken", char(9)||char(10)||char(13)||' ')) > 0)) IS NOT TRUE THEN RAISE(ABORT, 'Validation: UserCredentials.verificationToken') END;
SELECT CASE WHEN ((typeof(NEW."createdAt") = 'integer' OR (typeof(NEW."createdAt") = 'text' AND julianday(NEW."createdAt") IS NOT NULL))) IS NOT TRUE THEN RAISE(ABORT, 'Validation: UserCredentials.createdAt') END;
END;

DROP TRIGGER IF EXISTS "validate_UserProfile_insert";

CREATE TRIGGER "validate_UserProfile_insert" BEFORE INSERT ON "UserProfile" BEGIN
SELECT CASE WHEN (typeof(NEW."email") = 'text' AND length(NEW."email") <= 254 AND length(trim(NEW."email", char(9)||char(10)||char(13)||' ')) > 0 AND NEW."email" = lower(trim(NEW."email")) AND NEW."email" GLOB '?*@?*.??*'
  AND length(NEW."email")-length(replace(NEW."email",'@',''))=1
  AND instr(NEW."email",' ')=0 AND instr(NEW."email",char(9))=0 AND instr(NEW."email",char(10))=0 AND instr(NEW."email",char(13))=0) IS NOT TRUE THEN RAISE(ABORT, 'Validation: UserProfile.email') END;
SELECT CASE WHEN (typeof(NEW."fullName") = 'text' AND length(NEW."fullName") <= 50 AND length(trim(NEW."fullName", char(9)||char(10)||char(13)||' ')) > 0) IS NOT TRUE THEN RAISE(ABORT, 'Validation: UserProfile.fullName') END;
SELECT CASE WHEN (NEW."phone" IS NULL OR (typeof(NEW."phone") = 'text' AND length(NEW."phone") <= 20 AND length(trim(NEW."phone", char(9)||char(10)||char(13)||' ')) > 0)) IS NOT TRUE THEN RAISE(ABORT, 'Validation: UserProfile.phone') END;
SELECT CASE WHEN (typeof(NEW."almostReadyAlerts") = 'integer' AND NEW."almostReadyAlerts" IN (0,1)) IS NOT TRUE THEN RAISE(ABORT, 'Validation: UserProfile.almostReadyAlerts') END;
SELECT CASE WHEN ((typeof(NEW."updatedAt") = 'integer' OR (typeof(NEW."updatedAt") = 'text' AND julianday(NEW."updatedAt") IS NOT NULL))) IS NOT TRUE THEN RAISE(ABORT, 'Validation: UserProfile.updatedAt') END;
END;

DROP TRIGGER IF EXISTS "validate_UserProfile_update";

CREATE TRIGGER "validate_UserProfile_update" BEFORE UPDATE ON "UserProfile" BEGIN
SELECT CASE WHEN (typeof(NEW."email") = 'text' AND length(NEW."email") <= 254 AND length(trim(NEW."email", char(9)||char(10)||char(13)||' ')) > 0 AND NEW."email" = lower(trim(NEW."email")) AND NEW."email" GLOB '?*@?*.??*'
  AND length(NEW."email")-length(replace(NEW."email",'@',''))=1
  AND instr(NEW."email",' ')=0 AND instr(NEW."email",char(9))=0 AND instr(NEW."email",char(10))=0 AND instr(NEW."email",char(13))=0) IS NOT TRUE THEN RAISE(ABORT, 'Validation: UserProfile.email') END;
SELECT CASE WHEN (typeof(NEW."fullName") = 'text' AND length(NEW."fullName") <= 50 AND length(trim(NEW."fullName", char(9)||char(10)||char(13)||' ')) > 0) IS NOT TRUE THEN RAISE(ABORT, 'Validation: UserProfile.fullName') END;
SELECT CASE WHEN (NEW."phone" IS NULL OR (typeof(NEW."phone") = 'text' AND length(NEW."phone") <= 20 AND length(trim(NEW."phone", char(9)||char(10)||char(13)||' ')) > 0)) IS NOT TRUE THEN RAISE(ABORT, 'Validation: UserProfile.phone') END;
SELECT CASE WHEN (typeof(NEW."almostReadyAlerts") = 'integer' AND NEW."almostReadyAlerts" IN (0,1)) IS NOT TRUE THEN RAISE(ABORT, 'Validation: UserProfile.almostReadyAlerts') END;
SELECT CASE WHEN ((typeof(NEW."updatedAt") = 'integer' OR (typeof(NEW."updatedAt") = 'text' AND julianday(NEW."updatedAt") IS NOT NULL))) IS NOT TRUE THEN RAISE(ABORT, 'Validation: UserProfile.updatedAt') END;
END;

DROP TRIGGER IF EXISTS "validate_Service_insert";

CREATE TRIGGER "validate_Service_insert" BEFORE INSERT ON "Service" BEGIN
SELECT CASE WHEN (typeof(NEW."name") = 'text' AND length(NEW."name") <= 100 AND length(trim(NEW."name", char(9)||char(10)||char(13)||' ')) > 0) IS NOT TRUE THEN RAISE(ABORT, 'Validation: Service.name') END;
SELECT CASE WHEN (typeof(NEW."description") = 'text' AND length(NEW."description") <= 500 AND length(trim(NEW."description", char(9)||char(10)||char(13)||' ')) > 0) IS NOT TRUE THEN RAISE(ABORT, 'Validation: Service.description') END;
SELECT CASE WHEN (typeof(NEW."expectedDuration") = 'integer' AND NEW."expectedDuration" BETWEEN 1 AND 2147483647) IS NOT TRUE THEN RAISE(ABORT, 'Validation: Service.expectedDuration') END;
SELECT CASE WHEN (typeof(NEW."priority") = 'text' AND NEW."priority" IN ('LOW','MEDIUM','HIGH')) IS NOT TRUE THEN RAISE(ABORT, 'Validation: Service.priority') END;
SELECT CASE WHEN (NEW."location" IS NULL OR (typeof(NEW."location") = 'text' AND length(NEW."location") <= 120)) IS NOT TRUE THEN RAISE(ABORT, 'Validation: Service.location') END;
SELECT CASE WHEN (NEW."contact" IS NULL OR (typeof(NEW."contact") = 'text' AND length(NEW."contact") <= 200)) IS NOT TRUE THEN RAISE(ABORT, 'Validation: Service.contact') END;
SELECT CASE WHEN (NEW."hours" IS NULL OR (typeof(NEW."hours") = 'text' AND length(NEW."hours") <= 120)) IS NOT TRUE THEN RAISE(ABORT, 'Validation: Service.hours') END;
SELECT CASE WHEN (NEW."instructions" IS NULL OR (typeof(NEW."instructions") = 'text' AND length(NEW."instructions") <= 500)) IS NOT TRUE THEN RAISE(ABORT, 'Validation: Service.instructions') END;
SELECT CASE WHEN (typeof(NEW."category") = 'text' AND NEW."category" IN ('Academic','Financial','Technology','Student support','Other')) IS NOT TRUE THEN RAISE(ABORT, 'Validation: Service.category') END;
SELECT CASE WHEN (NEW."maxCapacity" IS NULL OR (typeof(NEW."maxCapacity") = 'integer' AND NEW."maxCapacity" BETWEEN 1 AND 2147483647)) IS NOT TRUE THEN RAISE(ABORT, 'Validation: Service.maxCapacity') END;
SELECT CASE WHEN ((typeof(NEW."createdAt") = 'integer' OR (typeof(NEW."createdAt") = 'text' AND julianday(NEW."createdAt") IS NOT NULL))) IS NOT TRUE THEN RAISE(ABORT, 'Validation: Service.createdAt') END;
SELECT CASE WHEN ((typeof(NEW."updatedAt") = 'integer' OR (typeof(NEW."updatedAt") = 'text' AND julianday(NEW."updatedAt") IS NOT NULL))) IS NOT TRUE THEN RAISE(ABORT, 'Validation: Service.updatedAt') END;
END;

DROP TRIGGER IF EXISTS "validate_Service_update";

CREATE TRIGGER "validate_Service_update" BEFORE UPDATE ON "Service" BEGIN
SELECT CASE WHEN (typeof(NEW."name") = 'text' AND length(NEW."name") <= 100 AND length(trim(NEW."name", char(9)||char(10)||char(13)||' ')) > 0) IS NOT TRUE THEN RAISE(ABORT, 'Validation: Service.name') END;
SELECT CASE WHEN (typeof(NEW."description") = 'text' AND length(NEW."description") <= 500 AND length(trim(NEW."description", char(9)||char(10)||char(13)||' ')) > 0) IS NOT TRUE THEN RAISE(ABORT, 'Validation: Service.description') END;
SELECT CASE WHEN (typeof(NEW."expectedDuration") = 'integer' AND NEW."expectedDuration" BETWEEN 1 AND 2147483647) IS NOT TRUE THEN RAISE(ABORT, 'Validation: Service.expectedDuration') END;
SELECT CASE WHEN (typeof(NEW."priority") = 'text' AND NEW."priority" IN ('LOW','MEDIUM','HIGH')) IS NOT TRUE THEN RAISE(ABORT, 'Validation: Service.priority') END;
SELECT CASE WHEN (NEW."location" IS NULL OR (typeof(NEW."location") = 'text' AND length(NEW."location") <= 120)) IS NOT TRUE THEN RAISE(ABORT, 'Validation: Service.location') END;
SELECT CASE WHEN (NEW."contact" IS NULL OR (typeof(NEW."contact") = 'text' AND length(NEW."contact") <= 200)) IS NOT TRUE THEN RAISE(ABORT, 'Validation: Service.contact') END;
SELECT CASE WHEN (NEW."hours" IS NULL OR (typeof(NEW."hours") = 'text' AND length(NEW."hours") <= 120)) IS NOT TRUE THEN RAISE(ABORT, 'Validation: Service.hours') END;
SELECT CASE WHEN (NEW."instructions" IS NULL OR (typeof(NEW."instructions") = 'text' AND length(NEW."instructions") <= 500)) IS NOT TRUE THEN RAISE(ABORT, 'Validation: Service.instructions') END;
SELECT CASE WHEN (typeof(NEW."category") = 'text' AND NEW."category" IN ('Academic','Financial','Technology','Student support','Other')) IS NOT TRUE THEN RAISE(ABORT, 'Validation: Service.category') END;
SELECT CASE WHEN (NEW."maxCapacity" IS NULL OR (typeof(NEW."maxCapacity") = 'integer' AND NEW."maxCapacity" BETWEEN 1 AND 2147483647)) IS NOT TRUE THEN RAISE(ABORT, 'Validation: Service.maxCapacity') END;
SELECT CASE WHEN ((typeof(NEW."createdAt") = 'integer' OR (typeof(NEW."createdAt") = 'text' AND julianday(NEW."createdAt") IS NOT NULL))) IS NOT TRUE THEN RAISE(ABORT, 'Validation: Service.createdAt') END;
SELECT CASE WHEN ((typeof(NEW."updatedAt") = 'integer' OR (typeof(NEW."updatedAt") = 'text' AND julianday(NEW."updatedAt") IS NOT NULL))) IS NOT TRUE THEN RAISE(ABORT, 'Validation: Service.updatedAt') END;
END;

DROP TRIGGER IF EXISTS "validate_Queue_insert";

CREATE TRIGGER "validate_Queue_insert" BEFORE INSERT ON "Queue" BEGIN
SELECT CASE WHEN (typeof(NEW."serviceId") = 'integer' AND NEW."serviceId" BETWEEN 1 AND 2147483647) IS NOT TRUE THEN RAISE(ABORT, 'Validation: Queue.serviceId') END;
SELECT CASE WHEN (typeof(NEW."status") = 'text' AND NEW."status" IN ('OPEN','CLOSED')) IS NOT TRUE THEN RAISE(ABORT, 'Validation: Queue.status') END;
SELECT CASE WHEN ((typeof(NEW."createdAt") = 'integer' OR (typeof(NEW."createdAt") = 'text' AND julianday(NEW."createdAt") IS NOT NULL))) IS NOT TRUE THEN RAISE(ABORT, 'Validation: Queue.createdAt') END;
END;

DROP TRIGGER IF EXISTS "validate_Queue_update";

CREATE TRIGGER "validate_Queue_update" BEFORE UPDATE ON "Queue" BEGIN
SELECT CASE WHEN (typeof(NEW."serviceId") = 'integer' AND NEW."serviceId" BETWEEN 1 AND 2147483647) IS NOT TRUE THEN RAISE(ABORT, 'Validation: Queue.serviceId') END;
SELECT CASE WHEN (typeof(NEW."status") = 'text' AND NEW."status" IN ('OPEN','CLOSED')) IS NOT TRUE THEN RAISE(ABORT, 'Validation: Queue.status') END;
SELECT CASE WHEN ((typeof(NEW."createdAt") = 'integer' OR (typeof(NEW."createdAt") = 'text' AND julianday(NEW."createdAt") IS NOT NULL))) IS NOT TRUE THEN RAISE(ABORT, 'Validation: Queue.createdAt') END;
END;

DROP TRIGGER IF EXISTS "validate_QueueEntry_insert";

CREATE TRIGGER "validate_QueueEntry_insert" BEFORE INSERT ON "QueueEntry" BEGIN
SELECT CASE WHEN (typeof(NEW."queueId") = 'integer' AND NEW."queueId" BETWEEN 1 AND 2147483647) IS NOT TRUE THEN RAISE(ABORT, 'Validation: QueueEntry.queueId') END;
SELECT CASE WHEN (typeof(NEW."userId") = 'integer' AND NEW."userId" BETWEEN 1 AND 2147483647) IS NOT TRUE THEN RAISE(ABORT, 'Validation: QueueEntry.userId') END;
SELECT CASE WHEN (NEW."position" IS NULL OR (typeof(NEW."position") = 'integer' AND NEW."position" BETWEEN 1 AND 2147483647)) IS NOT TRUE THEN RAISE(ABORT, 'Validation: QueueEntry.position') END;
SELECT CASE WHEN (NEW."initialPosition" IS NULL OR (typeof(NEW."initialPosition") = 'integer' AND NEW."initialPosition" BETWEEN 1 AND 2147483647)) IS NOT TRUE THEN RAISE(ABORT, 'Validation: QueueEntry.initialPosition') END;
SELECT CASE WHEN (NEW."ticketId" IS NULL OR (typeof(NEW."ticketId") = 'text' AND length(NEW."ticketId") <= 32 AND length(trim(NEW."ticketId", char(9)||char(10)||char(13)||' ')) > 0)) IS NOT TRUE THEN RAISE(ABORT, 'Validation: QueueEntry.ticketId') END;
SELECT CASE WHEN ((typeof(NEW."joinedAt") = 'integer' OR (typeof(NEW."joinedAt") = 'text' AND julianday(NEW."joinedAt") IS NOT NULL))) IS NOT TRUE THEN RAISE(ABORT, 'Validation: QueueEntry.joinedAt') END;
SELECT CASE WHEN (typeof(NEW."status") = 'text' AND NEW."status" IN ('WAITING','SERVED','CANCELED')) IS NOT TRUE THEN RAISE(ABORT, 'Validation: QueueEntry.status') END;
SELECT CASE WHEN ((NEW."status" = 'WAITING' AND NEW."position" IS NOT NULL) OR (NEW."status" != 'WAITING' AND NEW."position" IS NULL)) IS NOT TRUE THEN RAISE(ABORT, 'Validation: QueueEntry.activePosition') END;
END;

DROP TRIGGER IF EXISTS "validate_QueueEntry_update";

CREATE TRIGGER "validate_QueueEntry_update" BEFORE UPDATE ON "QueueEntry" BEGIN
SELECT CASE WHEN (typeof(NEW."queueId") = 'integer' AND NEW."queueId" BETWEEN 1 AND 2147483647) IS NOT TRUE THEN RAISE(ABORT, 'Validation: QueueEntry.queueId') END;
SELECT CASE WHEN (typeof(NEW."userId") = 'integer' AND NEW."userId" BETWEEN 1 AND 2147483647) IS NOT TRUE THEN RAISE(ABORT, 'Validation: QueueEntry.userId') END;
SELECT CASE WHEN (NEW."position" IS NULL OR (typeof(NEW."position") = 'integer' AND NEW."position" BETWEEN 1 AND 2147483647)) IS NOT TRUE THEN RAISE(ABORT, 'Validation: QueueEntry.position') END;
SELECT CASE WHEN (NEW."initialPosition" IS NULL OR (typeof(NEW."initialPosition") = 'integer' AND NEW."initialPosition" BETWEEN 1 AND 2147483647)) IS NOT TRUE THEN RAISE(ABORT, 'Validation: QueueEntry.initialPosition') END;
SELECT CASE WHEN (NEW."ticketId" IS NULL OR (typeof(NEW."ticketId") = 'text' AND length(NEW."ticketId") <= 32 AND length(trim(NEW."ticketId", char(9)||char(10)||char(13)||' ')) > 0)) IS NOT TRUE THEN RAISE(ABORT, 'Validation: QueueEntry.ticketId') END;
SELECT CASE WHEN ((typeof(NEW."joinedAt") = 'integer' OR (typeof(NEW."joinedAt") = 'text' AND julianday(NEW."joinedAt") IS NOT NULL))) IS NOT TRUE THEN RAISE(ABORT, 'Validation: QueueEntry.joinedAt') END;
SELECT CASE WHEN (typeof(NEW."status") = 'text' AND NEW."status" IN ('WAITING','SERVED','CANCELED')) IS NOT TRUE THEN RAISE(ABORT, 'Validation: QueueEntry.status') END;
SELECT CASE WHEN ((NEW."status" = 'WAITING' AND NEW."position" IS NOT NULL) OR (NEW."status" != 'WAITING' AND NEW."position" IS NULL)) IS NOT TRUE THEN RAISE(ABORT, 'Validation: QueueEntry.activePosition') END;
END;

DROP TRIGGER IF EXISTS "validate_History_insert";

CREATE TRIGGER "validate_History_insert" BEFORE INSERT ON "History" BEGIN
SELECT CASE WHEN (typeof(NEW."entryId") = 'integer' AND NEW."entryId" BETWEEN 1 AND 2147483647) IS NOT TRUE THEN RAISE(ABORT, 'Validation: History.entryId') END;
SELECT CASE WHEN (typeof(NEW."status") = 'text' AND NEW."status" IN ('SERVED','LEFT','NO_SHOW')) IS NOT TRUE THEN RAISE(ABORT, 'Validation: History.status') END;
SELECT CASE WHEN (NEW."servedAt" IS NULL OR ((typeof(NEW."servedAt") = 'integer' OR (typeof(NEW."servedAt") = 'text' AND julianday(NEW."servedAt") IS NOT NULL)))) IS NOT TRUE THEN RAISE(ABORT, 'Validation: History.servedAt') END;
SELECT CASE WHEN ((typeof(NEW."completedAt") = 'integer' OR (typeof(NEW."completedAt") = 'text' AND julianday(NEW."completedAt") IS NOT NULL))) IS NOT TRUE THEN RAISE(ABORT, 'Validation: History.completedAt') END;
SELECT CASE WHEN (typeof(NEW."problem") = 'text' AND length(NEW."problem") <= 500) IS NOT TRUE THEN RAISE(ABORT, 'Validation: History.problem') END;
SELECT CASE WHEN (typeof(NEW."notes") = 'text' AND length(NEW."notes") <= 500) IS NOT TRUE THEN RAISE(ABORT, 'Validation: History.notes') END;
SELECT CASE WHEN (NEW."outcome" IS NULL OR (typeof(NEW."outcome") = 'text' AND NEW."outcome" IN ('completed','referred','unresolved','follow-up'))) IS NOT TRUE THEN RAISE(ABORT, 'Validation: History.outcome') END;
END;

DROP TRIGGER IF EXISTS "validate_History_update";

CREATE TRIGGER "validate_History_update" BEFORE UPDATE ON "History" BEGIN
SELECT CASE WHEN (typeof(NEW."entryId") = 'integer' AND NEW."entryId" BETWEEN 1 AND 2147483647) IS NOT TRUE THEN RAISE(ABORT, 'Validation: History.entryId') END;
SELECT CASE WHEN (typeof(NEW."status") = 'text' AND NEW."status" IN ('SERVED','LEFT','NO_SHOW')) IS NOT TRUE THEN RAISE(ABORT, 'Validation: History.status') END;
SELECT CASE WHEN (NEW."servedAt" IS NULL OR ((typeof(NEW."servedAt") = 'integer' OR (typeof(NEW."servedAt") = 'text' AND julianday(NEW."servedAt") IS NOT NULL)))) IS NOT TRUE THEN RAISE(ABORT, 'Validation: History.servedAt') END;
SELECT CASE WHEN ((typeof(NEW."completedAt") = 'integer' OR (typeof(NEW."completedAt") = 'text' AND julianday(NEW."completedAt") IS NOT NULL))) IS NOT TRUE THEN RAISE(ABORT, 'Validation: History.completedAt') END;
SELECT CASE WHEN (typeof(NEW."problem") = 'text' AND length(NEW."problem") <= 500) IS NOT TRUE THEN RAISE(ABORT, 'Validation: History.problem') END;
SELECT CASE WHEN (typeof(NEW."notes") = 'text' AND length(NEW."notes") <= 500) IS NOT TRUE THEN RAISE(ABORT, 'Validation: History.notes') END;
SELECT CASE WHEN (NEW."outcome" IS NULL OR (typeof(NEW."outcome") = 'text' AND NEW."outcome" IN ('completed','referred','unresolved','follow-up'))) IS NOT TRUE THEN RAISE(ABORT, 'Validation: History.outcome') END;
END;

DROP TRIGGER IF EXISTS "validate_Notification_insert";

CREATE TRIGGER "validate_Notification_insert" BEFORE INSERT ON "Notification" BEGIN
SELECT CASE WHEN (typeof(NEW."userId") = 'integer' AND NEW."userId" BETWEEN 1 AND 2147483647) IS NOT TRUE THEN RAISE(ABORT, 'Validation: Notification.userId') END;
SELECT CASE WHEN (typeof(NEW."kind") = 'text' AND length(NEW."kind") <= 32 AND length(trim(NEW."kind", char(9)||char(10)||char(13)||' ')) > 0) IS NOT TRUE THEN RAISE(ABORT, 'Validation: Notification.kind') END;
SELECT CASE WHEN (typeof(NEW."title") = 'text' AND length(NEW."title") <= 100) IS NOT TRUE THEN RAISE(ABORT, 'Validation: Notification.title') END;
SELECT CASE WHEN (typeof(NEW."message") = 'text' AND length(NEW."message") <= 1000 AND length(trim(NEW."message", char(9)||char(10)||char(13)||' ')) > 0) IS NOT TRUE THEN RAISE(ABORT, 'Validation: Notification.message') END;
SELECT CASE WHEN (NEW."serviceId" IS NULL OR (typeof(NEW."serviceId") = 'integer' AND NEW."serviceId" BETWEEN 1 AND 2147483647)) IS NOT TRUE THEN RAISE(ABORT, 'Validation: Notification.serviceId') END;
SELECT CASE WHEN (NEW."ticketId" IS NULL OR (typeof(NEW."ticketId") = 'text' AND length(NEW."ticketId") <= 32 AND length(trim(NEW."ticketId", char(9)||char(10)||char(13)||' ')) > 0)) IS NOT TRUE THEN RAISE(ABORT, 'Validation: Notification.ticketId') END;
SELECT CASE WHEN (NEW."entryId" IS NULL OR (typeof(NEW."entryId") = 'integer' AND NEW."entryId" BETWEEN 1 AND 2147483647)) IS NOT TRUE THEN RAISE(ABORT, 'Validation: Notification.entryId') END;
SELECT CASE WHEN (typeof(NEW."status") = 'text' AND NEW."status" IN ('SENT','VIEWED')) IS NOT TRUE THEN RAISE(ABORT, 'Validation: Notification.status') END;
SELECT CASE WHEN ((typeof(NEW."createdAt") = 'integer' OR (typeof(NEW."createdAt") = 'text' AND julianday(NEW."createdAt") IS NOT NULL))) IS NOT TRUE THEN RAISE(ABORT, 'Validation: Notification.createdAt') END;
END;

DROP TRIGGER IF EXISTS "validate_Notification_update";

CREATE TRIGGER "validate_Notification_update" BEFORE UPDATE ON "Notification" BEGIN
SELECT CASE WHEN (typeof(NEW."userId") = 'integer' AND NEW."userId" BETWEEN 1 AND 2147483647) IS NOT TRUE THEN RAISE(ABORT, 'Validation: Notification.userId') END;
SELECT CASE WHEN (typeof(NEW."kind") = 'text' AND length(NEW."kind") <= 32 AND length(trim(NEW."kind", char(9)||char(10)||char(13)||' ')) > 0) IS NOT TRUE THEN RAISE(ABORT, 'Validation: Notification.kind') END;
SELECT CASE WHEN (typeof(NEW."title") = 'text' AND length(NEW."title") <= 100) IS NOT TRUE THEN RAISE(ABORT, 'Validation: Notification.title') END;
SELECT CASE WHEN (typeof(NEW."message") = 'text' AND length(NEW."message") <= 1000 AND length(trim(NEW."message", char(9)||char(10)||char(13)||' ')) > 0) IS NOT TRUE THEN RAISE(ABORT, 'Validation: Notification.message') END;
SELECT CASE WHEN (NEW."serviceId" IS NULL OR (typeof(NEW."serviceId") = 'integer' AND NEW."serviceId" BETWEEN 1 AND 2147483647)) IS NOT TRUE THEN RAISE(ABORT, 'Validation: Notification.serviceId') END;
SELECT CASE WHEN (NEW."ticketId" IS NULL OR (typeof(NEW."ticketId") = 'text' AND length(NEW."ticketId") <= 32 AND length(trim(NEW."ticketId", char(9)||char(10)||char(13)||' ')) > 0)) IS NOT TRUE THEN RAISE(ABORT, 'Validation: Notification.ticketId') END;
SELECT CASE WHEN (NEW."entryId" IS NULL OR (typeof(NEW."entryId") = 'integer' AND NEW."entryId" BETWEEN 1 AND 2147483647)) IS NOT TRUE THEN RAISE(ABORT, 'Validation: Notification.entryId') END;
SELECT CASE WHEN (typeof(NEW."status") = 'text' AND NEW."status" IN ('SENT','VIEWED')) IS NOT TRUE THEN RAISE(ABORT, 'Validation: Notification.status') END;
SELECT CASE WHEN ((typeof(NEW."createdAt") = 'integer' OR (typeof(NEW."createdAt") = 'text' AND julianday(NEW."createdAt") IS NOT NULL))) IS NOT TRUE THEN RAISE(ABORT, 'Validation: Notification.createdAt') END;
END;

CREATE UNIQUE INDEX IF NOT EXISTS "UserCredentials_email_nocase_key" ON "UserCredentials"(email COLLATE NOCASE);

CREATE UNIQUE INDEX IF NOT EXISTS "UserProfile_email_nocase_key" ON "UserProfile"(email COLLATE NOCASE);
