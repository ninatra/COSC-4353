// SQLite ignores VARCHAR lengths. Triggers enforce these rules even for raw SQL.
const text = (field, max, required = false) =>
  `typeof("${field}") = 'text' AND length("${field}") <= ${max}${required ? ` AND length(trim("${field}", char(9)||char(10)||char(13)||' ')) > 0` : ''}`;
const integer = field => `typeof("${field}") = 'integer' AND "${field}" BETWEEN 1 AND 2147483647`;
const optional = (field, rule) => `"${field}" IS NULL OR (${rule})`;
const choice = (field, values) => `typeof("${field}") = 'text' AND "${field}" IN (${values.map(value => `'${value}'`).join(',')})`;
const boolean = field => `typeof("${field}") = 'integer' AND "${field}" IN (0,1)`;
const date = field => `(typeof("${field}") = 'integer' OR (typeof("${field}") = 'text' AND julianday("${field}") IS NOT NULL))`;
const email = `${text('email', 254, true)} AND "email" = lower(trim("email")) AND "email" GLOB '?*@?*.??*'
  AND length("email")-length(replace("email",'@',''))=1
  AND instr("email",' ')=0 AND instr("email",char(9))=0 AND instr("email",char(10))=0 AND instr("email",char(13))=0`;

export const rules = {
  UserCredentials: {
    email, passwordHash: text('passwordHash', 255, true), role: choice('role', ['USER', 'ADMIN']),
    emailVerified: boolean('emailVerified'), verificationToken: optional('verificationToken', text('verificationToken', 128, true)),
    createdAt: date('createdAt'),
  },
  UserProfile: {
    email, fullName: text('fullName', 50, true), phone: optional('phone', text('phone', 20, true)),
    almostReadyAlerts: boolean('almostReadyAlerts'), updatedAt: date('updatedAt'),
  },
  Service: {
    name: text('name', 100, true), description: text('description', 500, true), expectedDuration: integer('expectedDuration'),
    priority: choice('priority', ['LOW', 'MEDIUM', 'HIGH']), location: optional('location', text('location', 120)), contact: optional('contact', text('contact', 200)),
    hours: optional('hours', text('hours', 120)), instructions: optional('instructions', text('instructions', 500)),
    category: choice('category', ['Academic', 'Financial', 'Technology', 'Student support', 'Other']),
    maxCapacity: optional('maxCapacity', integer('maxCapacity')), createdAt: date('createdAt'), updatedAt: date('updatedAt'),
  },
  Queue: { serviceId: integer('serviceId'), status: choice('status', ['OPEN', 'CLOSED']), createdAt: date('createdAt') },
  QueueEntry: {
    queueId: integer('queueId'), userId: integer('userId'), position: optional('position', integer('position')),
    initialPosition: optional('initialPosition', integer('initialPosition')), ticketId: optional('ticketId', text('ticketId', 32, true)),
    joinedAt: date('joinedAt'), status: choice('status', ['WAITING', 'SERVED', 'CANCELED']),
    activePosition: `("status" = 'WAITING' AND "position" IS NOT NULL) OR ("status" != 'WAITING' AND "position" IS NULL)`,
  },
  History: {
    entryId: integer('entryId'), status: choice('status', ['SERVED', 'LEFT', 'NO_SHOW']), servedAt: optional('servedAt', date('servedAt')),
    completedAt: date('completedAt'), problem: text('problem', 500), notes: text('notes', 500),
    outcome: optional('outcome', choice('outcome', ['completed', 'referred', 'unresolved', 'follow-up'])),
  },
  Notification: {
    userId: integer('userId'), kind: text('kind', 32, true), title: text('title', 100), message: text('message', 1000, true),
    serviceId: optional('serviceId', integer('serviceId')), ticketId: optional('ticketId', text('ticketId', 32, true)),
    entryId: optional('entryId', integer('entryId')), status: choice('status', ['SENT', 'VIEWED']), createdAt: date('createdAt'),
  },
};

export function constraintStatements() {
  const statements = [];
  for (const [table, fields] of Object.entries(rules)) {
    for (const event of ['INSERT', 'UPDATE']) {
      const name = `validate_${table}_${event.toLowerCase()}`;
      const checks = Object.entries(fields).map(([field, rule]) =>
        `SELECT CASE WHEN (${rule.replace(/"([^"]+)"/g, 'NEW."$1"')}) IS NOT TRUE THEN RAISE(ABORT, 'Validation: ${table}.${field}') END;`);
      statements.push(`DROP TRIGGER IF EXISTS "${name}"`);
      statements.push(`CREATE TRIGGER "${name}" BEFORE ${event} ON "${table}" BEGIN\n${checks.join('\n')}\nEND`);
    }
  }
  statements.push('CREATE UNIQUE INDEX IF NOT EXISTS "UserCredentials_email_nocase_key" ON "UserCredentials"(email COLLATE NOCASE)');
  statements.push('CREATE UNIQUE INDEX IF NOT EXISTS "UserProfile_email_nocase_key" ON "UserProfile"(email COLLATE NOCASE)');
  return statements;
}

export async function applyConstraints(db) {
  await db.$transaction(async tx => {
    // Refuse invalid existing data rather than installing rules over it silently.
    for (const [table, fields] of Object.entries(rules)) {
      for (const [field, rule] of Object.entries(fields)) {
        const rows = await tx.$queryRawUnsafe(`SELECT 1 FROM "${table}" WHERE (${rule}) IS NOT TRUE LIMIT 1`);
        if (rows.length) throw new Error(`Existing data violates ${table}.${field}; no constraints changed.`);
      }
    }
    for (const statement of constraintStatements()) await tx.$executeRawUnsafe(statement);
  }, { timeout: 30000 });
}
