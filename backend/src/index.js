const express = require('express');
const cors = require('cors');
const { extractContext } = require('./middleware');
const db = require('./database');
const { createTriggeredNotifications } = require('./triggers');

const app = express();
const PORT = process.env.PORT || 3001;
const allowedOrigins = (process.env.CORS_ORIGINS || `${process.env.FRONTEND_URL || ''},http://localhost:3000,http://127.0.0.1:3000`)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(null, false);
  },
  credentials: true
}));
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use(extractContext);

app.post('/notifications', async (req, res) => {
  const { type, title, body, userId } = req.body;

  if (!type || !title || !body) {
    return res.status(400).json({
      error: 'Missing required fields: type, title, body'
    });
  }

  try {
    const notification = await db.createNotification({
      tenantId: req.tenantId,
      userId: userId || null,
      type,
      title,
      body
    });

    res.status(201).json(notification);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create notification' });
  }
});

app.get('/notifications', async (req, res) => {
  try {
    const notifications = await db.getUserNotifications(req.tenantId, req.userId);

    const page = parseInt(req.query.page) || 0;
    const limit = parseInt(req.query.limit) || 20;
    const start = page * limit;
    const paginated = notifications.slice(start, start + limit);

    res.json({
      notifications: paginated,
      total: notifications.length,
      page,
      limit,
      hasMore: start + limit < notifications.length
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

app.get('/notifications/unread-count', async (req, res) => {
  try {
    const count = await db.getUnreadCount(req.tenantId, req.userId);
    res.json({ unreadCount: count });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get unread count' });
  }
});

app.patch('/notifications/:id/read', async (req, res) => {
  try {
    const notification = await db.markNotificationAsRead(req.params.id, req.tenantId);

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json(notification);
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

app.patch('/notifications/read-all', async (req, res) => {
  try {
    const count = await db.markAllNotificationsAsRead(req.tenantId, req.userId);
    res.json({ markedAsRead: count });
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark notifications as read' });
  }
});

app.post('/demo/trigger', async (req, res) => {
  const { scenario } = req.query;

  if (!scenario) {
    return res.status(400).json({
      error: 'Missing query parameter: scenario (member_invited or creator_replied)'
    });
  }

  try {
    const notifications = await createTriggeredNotifications(req.tenantId, req.userId, scenario);

    res.status(201).json({
      message: `Triggered ${scenario}`,
      notifications
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/demo/reset', async (req, res) => {
  try {
    await db.resetDatabase();
    res.json({ message: 'Database reset to seed state' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reset database' });
  }
});

app.listen(PORT, () => {
  console.log(`Notification API running on http://localhost:${PORT}`);
  console.log(`CORS enabled for http://localhost:3000`);
  console.log('Headers required: X-Tenant-Id, X-User-Id');
});
