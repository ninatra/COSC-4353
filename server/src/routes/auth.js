import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth, signToken } from '../middleware/auth.js';
import { validateLogin, validateRegistration } from '../validation/auth.js';

const router = Router();

// Never send the password hash or verification token to the client.
function publicUser(user) {
  const { id, name, email, role, emailVerified, createdAt } = user;
  return { id, name, email, role, emailVerified, createdAt };
}

router.post('/register', async (req, res) => {
  const { data, status, error } = validateRegistration(req.body, process.env.ADMIN_SIGNUP_CODE);
  if (error) return res.status(status).json({ error });
  const { name, email: normalizedEmail, password, role } = data;

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    return res.status(409).json({ error: 'An account with this email already exists' });
  }

  const user = await prisma.user.create({
    data: {
      name,
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
  const { data, status, error } = validateLogin(req.body);
  if (error) return res.status(status).json({ error });
  const { email, password } = data;

  const user = await prisma.user.findUnique({
    where: { email },
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
