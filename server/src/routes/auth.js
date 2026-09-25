import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { ROLES } from '../constants.js';
import { prisma } from '../db.js';
import { requireAuth, signToken } from '../middleware/auth.js';

const router = Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Never send the password hash or verification token to the client.
function publicUser(user) {
  const { id, name, email, role, emailVerified, createdAt } = user;
  return { id, name, email, role, emailVerified, createdAt };
}

router.post('/register', async (req, res) => {
  const { name, email, password, role = 'USER', adminCode } = req.body ?? {};

  if (!name?.trim() || !email?.trim() || !password) {
    return res.status(400).json({ error: 'Name, email and password are required' });
  }
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Email address is not valid' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  if (!ROLES.includes(role)) {
    return res.status(400).json({ error: 'Role must be USER or ADMIN' });
  }
  if (role === 'ADMIN' && adminCode !== process.env.ADMIN_SIGNUP_CODE) {
    return res.status(403).json({ error: 'Invalid administrator code' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    return res.status(409).json({ error: 'An account with this email already exists' });
  }

  const user = await prisma.user.create({
    data: {
      name: name.trim(),
      email: normalizedEmail,
      passwordHash: await bcrypt.hash(password, 10),
      role,
      verificationToken: randomBytes(24).toString('hex'),
    },
  });

  // Email verification is design-only for now: instead of sending an email,
  // print the link that the email would contain.
  const verifyUrl = `${process.env.CLIENT_URL}/verify/${user.verificationToken}`;
  console.log(`[email] Verification link for ${user.email}: ${verifyUrl}`);

  res.status(201).json({ token: signToken(user), user: publicUser(user) });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
  });
  // Same message for unknown email and wrong password so attackers can't
  // discover which emails are registered.
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: 'Incorrect email or password' });
  }

  res.json({ token: signToken(user), user: publicUser(user) });
});

router.get('/verify/:token', async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { verificationToken: req.params.token },
  });
  if (!user) {
    return res.status(400).json({ error: 'Verification link is invalid or already used' });
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerified: true, verificationToken: null },
  });
  res.json({ message: 'Email verified' });
});

router.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json({ user: publicUser(user) });
});

export default router;
