-- Upgrade the previous combined QueueEntry schema without losing visits.
PRAGMA foreign_keys=OFF;
BEGIN IMMEDIATE;
CREATE TABLE "Queue" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "serviceId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Queue_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "Queue" (id,serviceId,status,createdAt)
SELECT id,id,CASE WHEN isOpen THEN 'OPEN' ELSE 'CLOSED' END,createdAt FROM "Service";
CREATE TABLE "new_QueueEntry" (
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
INSERT INTO "new_QueueEntry" (id,queueId,userId,position,ticketId,initialPosition,joinedAt,status)
SELECT id,serviceId,userId,
 CASE WHEN status IN ('WAITING','SERVING') THEN
 ROW_NUMBER() OVER (PARTITION BY serviceId, (status IN ('WAITING','SERVING'))
 ORDER BY COALESCE(manualOrder,2147483647),CASE priority WHEN 'HIGH' THEN 0 WHEN 'LOW' THEN 2 ELSE 1 END,joinedAt,id)
 ELSE NULL END,
 ticketId,initialPosition,joinedAt,
 CASE WHEN status IN ('WAITING','SERVING') THEN 'WAITING' WHEN status='SERVED' THEN 'SERVED' ELSE 'CANCELED' END
FROM "QueueEntry";
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
INSERT INTO "History" (entryId,status,servedAt,completedAt,problem,outcome,notes)
SELECT id,status,servedAt,COALESCE(completedAt,servedAt,joinedAt),problem,outcome,notes
FROM "QueueEntry" WHERE status IN ('SERVED','LEFT','NO_SHOW');
DROP TABLE "QueueEntry";
ALTER TABLE "new_QueueEntry" RENAME TO "QueueEntry";
CREATE TABLE "new_Service" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "expectedDuration" INTEGER NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "location" TEXT NOT NULL DEFAULT '',
    "contact" TEXT NOT NULL DEFAULT '',
    "hours" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT 'Other',
    "maxCapacity" INTEGER,
    "instructions" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Service" (id,name,description,expectedDuration,priority,location,contact,hours,category,maxCapacity,instructions,createdAt,updatedAt) SELECT id,name,description,expectedDuration,priority,location,contact,hours,category,maxCapacity,instructions,createdAt,updatedAt FROM "Service";
DROP TABLE "Service";
ALTER TABLE "new_Service" RENAME TO "Service";
CREATE UNIQUE INDEX "Queue_serviceId_key" ON "Queue"("serviceId");
CREATE INDEX "QueueEntry_queueId_status_position_idx" ON "QueueEntry"("queueId","status","position");
CREATE INDEX "QueueEntry_userId_idx" ON "QueueEntry"("userId");
CREATE INDEX "History_completedAt_idx" ON "History"("completedAt");
COMMIT;
PRAGMA foreign_keys=ON;
