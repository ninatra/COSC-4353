import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { prisma } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { publicUser } from '../logic/users.js';
import { validateProfile } from '../validation/profile.js';

const router = Router();
router.use(requireAuth);

// The signed-in user's login details plus profile (UserCredentials + UserProfile).
router.get('/', async (req, res) => {
  const user = await prisma.userCredentials.findUnique({ where: { id: req.user.id }, include: { profile: true } });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user: publicUser(user) });
});

router.put('/', async (req, res) => {
  const { data, error } = validateProfile(req.body);
  if (error) return res.status(400).json({ error });
  const user = await prisma.userCredentials.findUnique({ where: { id: req.user.id } });
  if (!user) return res.status(404).json({ error: 'User not found' });
  const { email = user.email, ...profileData } = data;
  const emailChanged = email !== user.email;
  const verificationToken = emailChanged ? randomBytes(24).toString('hex') : undefined;
  let updated;
  try {
    updated = await prisma.$transaction(async (tx) => {
      // Updating the login cascades the new email to its existing profile.
      await tx.userCredentials.update({
        where: { id: user.id },
        data: emailChanged ? { email, emailVerified: false, verificationToken } : {},
      });
      await tx.userProfile.upsert({
        where: { email },
        update: profileData,
        create: { email, fullName: profileData.fullName ?? email, ...profileData },
      });
      return tx.userCredentials.findUnique({ where: { id: user.id }, include: { profile: true } });
    });
  } catch (error) {
    if (error.code === 'P2002') return res.status(409).json({ error: 'An account with this email already exists' });
    throw error;
  }
  if (emailChanged) {
    console.log(`[email] Verification link for ${email}: ${process.env.CLIENT_URL}/verify/${verificationToken}`);
  }
  res.json({ user: publicUser(updated) });
});

export default router;
