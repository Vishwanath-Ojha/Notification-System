require('dotenv').config();
const { Pool } = require('pg');
const { randomUUID } = require('crypto');

const MEMORY_SEED_NOTIFICATIONS = [
  {
    id: 'n1',
    tenantId: 't1',
    userId: null,
    type: 'member_invited',
    title: 'New team member',
    body: 'Sarah joined Nova Talent',
    read: false,
    createdAt: '2026-07-01T09:00:00Z',
    readAt: null
  },
  {
    id: 'n2',
    tenantId: 't1',
    userId: 'u1',
    type: 'new_reply',
    title: 'Creator replied',
    body: 'Priya Sharma replied to your outreach message',
    read: false,
    createdAt: '2026-07-02T14:30:00Z',
    readAt: null
  },
  {
    id: 'n3',
    tenantId: 't1',
    userId: 'u1',
    type: 'report_ready',
    title: 'Report ready',
    body: 'Your July campaign report is ready to view',
    read: true,
    createdAt: '2026-06-28T08:00:00Z',
    readAt: '2026-06-28T10:00:00Z'
  },
  {
    id: 'n4',
    tenantId: 't2',
    userId: null,
    type: 'member_invited',
    title: 'New team member',
    body: 'James joined Bright Star Agency',
    read: false,
    createdAt: '2026-07-01T09:05:00Z',
    readAt: null
  }
];

let memoryNotifications = MEMORY_SEED_NOTIFICATIONS.map((notification) => ({ ...notification }));
let nextMemoryId = 5;
let pool = null;
let usingPostgres = false;
let initializationComplete = false;
let initializationError = null;

function serializeValue(value) {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
}

function normalizeNotification(row) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    body: row.body,
    read: row.read,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    readAt: row.read_at instanceof Date ? row.read_at.toISOString() : row.read_at
  };
}

function createMemoryNotification(data) {
  const notification = {
    id: data.id || `n${nextMemoryId++}`,
    tenantId: data.tenantId,
    userId: data.userId || null,
    type: data.type,
    title: data.title,
    body: data.body,
    read: false,
    createdAt: data.createdAt || new Date().toISOString(),
    readAt: null
  };

  memoryNotifications.push(notification);
  return notification;
}

function getMemoryUserNotifications(tenantId, userId) {
  return memoryNotifications
    .filter((notification) => notification.tenantId === tenantId && (notification.userId === null || notification.userId === userId))
    .sort((a, b) => {
      if (a.read !== b.read) {
        return a.read ? 1 : -1;
      }
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
}

function getMemoryUnreadCount(tenantId, userId) {
  return memoryNotifications.filter((notification) => !notification.read && notification.tenantId === tenantId && (notification.userId === null || notification.userId === userId)).length;
}

function getMemoryNotificationById(notificationId, tenantId) {
  const notification = memoryNotifications.find((item) => item.id === notificationId);
  if (!notification) return null;

  if (notification.tenantId !== tenantId) {
    return null;
  }

  return notification;
}

function markMemoryNotificationAsRead(notificationId, tenantId) {
  const notification = getMemoryNotificationById(notificationId, tenantId);
  if (!notification) return null;

  notification.read = true;
  notification.readAt = new Date().toISOString();
  return notification;
}

function markMemoryAllNotificationsAsRead(tenantId, userId) {
  let count = 0;
  const userNotifications = getMemoryUserNotifications(tenantId, userId);

  userNotifications.forEach((notification) => {
    if (!notification.read) {
      notification.read = true;
      notification.readAt = new Date().toISOString();
      count += 1;
    }
  });

  return count;
}

function resetMemoryDatabase() {
  memoryNotifications = MEMORY_SEED_NOTIFICATIONS.map((notification) => ({ ...notification }));
  nextMemoryId = 5;
}

async function ensureDatabaseConnection() {
  if (initializationComplete) {
    return;
  }

  if (!process.env.DATABASE_URL) {
    usingPostgres = false;
    initializationComplete = true;
    return;
  }

  try {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes('localhost') || process.env.DATABASE_URL.includes('127.0.0.1')
        ? false
        : { rejectUnauthorized: false }
    });

    await pool.query('SELECT NOW()');
    await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        user_id TEXT,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        read BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        read_at TIMESTAMPTZ
      )
    `);
    await pool.query('CREATE INDEX IF NOT EXISTS idx_notifications_tenant_user ON notifications (tenant_id, user_id, read)');

    const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM notifications');
    if (rows[0].count === 0) {
      for (const notification of MEMORY_SEED_NOTIFICATIONS) {
        await pool.query(
          `INSERT INTO notifications (id, tenant_id, user_id, type, title, body, read, created_at, read_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [notification.id, notification.tenantId, notification.userId, notification.type, notification.title, notification.body, notification.read, notification.createdAt, notification.readAt]
        );
      }
    }

    usingPostgres = true;
    initializationComplete = true;
    initializationError = null;
  } catch (error) {
    initializationError = error;
    usingPostgres = false;
    initializationComplete = true;
    console.warn(`PostgreSQL unavailable, falling back to in-memory store: ${error.message}`);
  }
}

async function createNotification(data) {
  await ensureDatabaseConnection();

  if (usingPostgres && pool) {
    const id = data.id || randomUUID();
    const createdAt = data.createdAt || new Date().toISOString();
    const result = await pool.query(
      `INSERT INTO notifications (id, tenant_id, user_id, type, title, body, read, created_at, read_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [id, data.tenantId, data.userId || null, data.type, data.title, data.body, false, createdAt, null]
    );
    return normalizeNotification(result.rows[0]);
  }

  return createMemoryNotification(data);
}

async function getUserNotifications(tenantId, userId) {
  await ensureDatabaseConnection();

  if (usingPostgres && pool) {
    const result = await pool.query(
      `SELECT * FROM notifications
       WHERE tenant_id = $1 AND (user_id IS NULL OR user_id = $2)
       ORDER BY CASE WHEN read = FALSE THEN 0 ELSE 1 END, created_at DESC`,
      [tenantId, userId]
    );
    return result.rows.map(normalizeNotification);
  }

  return getMemoryUserNotifications(tenantId, userId);
}

async function getUnreadCount(tenantId, userId) {
  await ensureDatabaseConnection();

  if (usingPostgres && pool) {
    const result = await pool.query(
      `SELECT COUNT(*)::int AS count FROM notifications
       WHERE tenant_id = $1 AND (user_id IS NULL OR user_id = $2) AND read = FALSE`,
      [tenantId, userId]
    );
    return result.rows[0].count;
  }

  return getMemoryUnreadCount(tenantId, userId);
}

async function getNotificationById(notificationId, tenantId) {
  await ensureDatabaseConnection();

  if (usingPostgres && pool) {
    const result = await pool.query(
      `SELECT * FROM notifications WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
      [notificationId, tenantId]
    );
    return result.rows[0] ? normalizeNotification(result.rows[0]) : null;
  }

  return getMemoryNotificationById(notificationId, tenantId);
}

async function markNotificationAsRead(notificationId, tenantId) {
  await ensureDatabaseConnection();

  if (usingPostgres && pool) {
    const result = await pool.query(
      `UPDATE notifications
       SET read = TRUE, read_at = NOW()
       WHERE id = $1 AND tenant_id = $2
       RETURNING *`,
      [notificationId, tenantId]
    );
    return result.rows[0] ? normalizeNotification(result.rows[0]) : null;
  }

  return markMemoryNotificationAsRead(notificationId, tenantId);
}

async function markAllNotificationsAsRead(tenantId, userId) {
  await ensureDatabaseConnection();

  if (usingPostgres && pool) {
    const result = await pool.query(
      `UPDATE notifications
       SET read = TRUE, read_at = NOW()
       WHERE tenant_id = $1 AND (user_id IS NULL OR user_id = $2) AND read = FALSE
       RETURNING id`,
      [tenantId, userId]
    );
    return result.rows.length;
  }

  return markMemoryAllNotificationsAsRead(tenantId, userId);
}

async function getAllNotifications() {
  await ensureDatabaseConnection();

  if (usingPostgres && pool) {
    const result = await pool.query('SELECT * FROM notifications ORDER BY created_at DESC');
    return result.rows.map(normalizeNotification);
  }

  return memoryNotifications;
}

async function resetDatabase() {
  await ensureDatabaseConnection();

  if (usingPostgres && pool) {
    await pool.query('DELETE FROM notifications');
    for (const notification of MEMORY_SEED_NOTIFICATIONS) {
      await pool.query(
        `INSERT INTO notifications (id, tenant_id, user_id, type, title, body, read, created_at, read_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [notification.id, notification.tenantId, notification.userId, notification.type, notification.title, notification.body, notification.read, notification.createdAt, notification.readAt]
      );
    }
    return;
  }

  resetMemoryDatabase();
}

module.exports = {
  createNotification,
  getUserNotifications,
  getUnreadCount,
  getNotificationById,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getAllNotifications,
  resetDatabase
};
