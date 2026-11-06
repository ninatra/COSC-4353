// Users are split across two tables: UserCredentials (login) and UserProfile
// (name, contact, preferences). These helpers join them back together for
// responses, so the client keeps seeing { name, email }.

// Prisma `select` for a visitor's public identity. Never includes the password hash.
export const identitySelect = { email: true, profile: { select: { fullName: true } } };

export function identity(user) {
  if (!user) return user;
  return { name: user.profile?.fullName ?? user.email, email: user.email };
}

// The signed-in account as the client sees it (login + profile, no secrets).
export function publicUser(credentials) {
  const { id, email, role, emailVerified, createdAt, profile } = credentials;
  return {
    id, email, role, emailVerified, createdAt,
    name: profile?.fullName ?? email,
    phone: profile?.phone ?? null,
    almostReadyAlerts: profile?.almostReadyAlerts ?? true,
  };
}
