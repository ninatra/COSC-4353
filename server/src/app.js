import cors from 'cors';
import express from 'express';
import authRoutes from './routes/auth.js';
import serviceRoutes from './routes/services.js';

export const app = express();

app.use(cors({ origin: process.env.CLIENT_URL }));
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', authRoutes);
app.use('/api/services', serviceRoutes);

// Routes still to build (see docs/ROADMAP.md):
//   /api/queues         join, leave, position & wait time, admin serve-next
//   /api/notifications  in-app notifications for the logged-in user
//   /api/history        user history and admin statistics

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// Express 5 forwards errors thrown in async handlers here automatically.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong' });
});
