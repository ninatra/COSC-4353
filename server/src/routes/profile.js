import { Router } from 'express';
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
  // Accounts created before profiles existed get one now.
  await prisma.userProfile.upsert({
    where: { email: user.email },
    update: data,
    create: { email: user.email, fullName: data.fullName ?? user.email, ...data },
  });
  const updated = await prisma.userCredentials.findUnique({ where: { id: req.user.id }, include: { profile: true } });
  res.json({ user: publicUser(updated) });
});

export default router;
