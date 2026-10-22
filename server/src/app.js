import cors from 'cors';
import express from 'express';
import authRoutes from './routes/auth.js';
import serviceRoutes from './routes/services.js';
import queueRoutes from './routes/queues.js';
import notificationRoutes from './routes/notifications.js';
import historyRoutes from './routes/history.js';

export const app = express();

app.use(cors({ origin: process.env.CLIENT_URL }));
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', authRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/queues', queueRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/history', historyRoutes);

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// Express 5 forwards errors thrown in async handlers here automatically.
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Request body must be valid JSON' });
  }
  console.error(err);
  res.status(500).json({ error: 'Something went wrong' });
});
