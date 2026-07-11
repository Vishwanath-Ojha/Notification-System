# Integration Write-up: Wiring Notifications into an Existing CRM

## The Scenario

You have an existing CRM with:
- Established user authentication (JWT tokens, session management)
- A database schema (Users, Tenants, Deals, Messages, etc.)
- Business logic scattered across services (user invites, message handlers, report generation, deal workflows)
- A React/Next.js frontend already pulling data from your API

**The question:** How do you actually add notifications without breaking everything?

---

## What Stays the Same

### 1. Auth & Tenant Context
Your existing auth layer is perfect. We don't replace it—we **leverage** it.

**Current state:**
```javascript
// Your existing middleware
app.use(validateJWT);  // Extracts user + tenant from token
app.use((req, res, next) => {
  req.tenantId = decoded.tenantId;  // Already available
  req.userId = decoded.userId;      // Already available
  next();
});
```

**What we do:**
```javascript
// Notification endpoints use the same auth
app.get('/notifications', validateJWT, (req, res) => {
  // req.tenantId and req.userId already there—
  // no change needed to your middleware
});
```

**No additional headers needed.** The `X-Tenant-Id` headers in this demo were for simplicity; in your system, they come from your JWT.

### 2. Frontend Integration
Your React app already has a way to fetch user data:
```javascript
// Existing API client
const api = makeAuthenticatedRequest('https://api.example.com');
const user = await api.get('/me');
```

**For notifications:**
```javascript
// Drop NotificationBell component anywhere
import NotificationBell from '@/components/NotificationBell';

<NotificationBell refreshInterval={20000} />
// It reads auth context from your existing headers
// (your API client already adds Authorization: Bearer ...)
```

No architectural shift needed—it's one more component in your app.

---

## What Changes: The Notification Layer

### 1. Database Schema

**New table:**
```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  user_id UUID REFERENCES users(id),  -- NULL = tenant-wide
  type VARCHAR(50) NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  read_at TIMESTAMP,
  created_by UUID REFERENCES users(id)  -- Optional: who triggered it
);

-- Critical indices for query performance
CREATE INDEX idx_notifications_tenant_user 
  ON notifications(tenant_id, user_id, read, created_at DESC);

CREATE INDEX idx_notifications_tenant_null_user 
  ON notifications(tenant_id, read, created_at DESC) 
  WHERE user_id IS NULL;
```

**Why those indices?**
- Most queries filter by `(tenant_id, user_id, read status)` and sort by `created_at`
- Tenant-wide notifications (user_id IS NULL) are a separate hot path
- Without these, even small databases crawl

**Migration:**
```javascript
// Use your existing migration tool (Prisma, Flyway, Alembic, etc.)
// This is 5 new columns on an append-only table—low risk
```

### 2. Trigger Points: Where Notifications Get Created

In your existing code, you have places where important things happen:

```javascript
// BEFORE: User invited, nothing happens downstream
async function inviteTeamMember(req, res) {
  const newUser = await User.create({ email, tenantId, role });
  res.json(newUser);
}

// AFTER: Same endpoint, plus notification
async function inviteTeamMember(req, res) {
  const newUser = await User.create({ email, tenantId, role });
  
  // NEW: Notify the team
  await notificationService.create({
    tenantId: req.tenantId,
    userId: null,  // Tenant-wide
    type: 'user_invited',
    title: 'New team member',
    body: `${email} has been invited`,
    createdBy: req.userId
  });
  
  res.json(newUser);
}
```

**Key principle:** Notification creation is **decoupled** from the main business logic.

If you're worried about performance:
```javascript
// Instead of awaiting, queue it for async processing
async function inviteTeamMember(req, res) {
  const newUser = await User.create({ email, tenantId, role });
  
  // Fire and forget—push to a job queue
  await notificationQueue.enqueue({
    event: 'user_invited',
    tenantId: req.tenantId,
    data: { email }
  });
  
  res.json(newUser);
}

// Separate worker processes the queue
worker.on('user_invited', async (job) => {
  await notificationService.create({
    tenantId: job.tenantId,
    userId: null,
    type: 'user_invited',
    title: 'New team member',
    body: `${job.data.email} has been invited`
  });
});
```

**Trigger points in your existing CRM:**

| Event | Endpoint | Notification |
|-------|----------|--------------|
| User invited | `POST /teams/:id/members` | "New team member invited" (tenant-wide) |
| Creator replies | `POST /messages/:id/reply` | "Creator replied" (specific user) |
| Deal moves | `PATCH /deals/:id` | "Deal stage updated" (tenant-wide) |
| Report generated | Job callback | "Report ready" (specific user) |
| Contract signed | `PATCH /deals/:id/sign` | "Contract signed" (team) |

### 3. The Notification Service

Extract notification creation logic into a reusable service:

```javascript
// services/notificationService.js
class NotificationService {
  async create(data) {
    // data = { tenantId, userId, type, title, body, createdBy }
    const notification = await db.notifications.create(data);
    
    // Real-time? Emit to WebSocket room
    if (this.io) {
      this.io.to(`tenant:${data.tenantId}`).emit('notification', notification);
    }
    
    return notification;
  }
  
  async getUserNotifications(tenantId, userId, options = {}) {
    const { page = 0, limit = 20 } = options;
    
    // CRITICAL: Where clause enforces isolation
    const notifications = await db.notifications.findMany({
      where: {
        tenantId,
        OR: [
          { userId: null },           // Tenant-wide
          { userId }                  // User-specific
        ]
      },
      orderBy: [
        { read: 'asc' },              // Unread first
        { createdAt: 'desc' }         // Then newest
      ],
      skip: page * limit,
      take: limit
    });
    
    return notifications;
  }
  
  async markAsRead(notificationId, tenantId, userId) {
    // Verify ownership before updating
    const notification = await db.notifications.findFirst({
      where: { id: notificationId, tenantId }
    });
    
    if (!notification) {
      throw new NotFoundError('Notification not found');
    }
    
    return db.notifications.update({
      where: { id: notificationId },
      data: { read: true, readAt: new Date() }
    });
  }
}

module.exports = new NotificationService();
```

### 4. API Endpoints

Add these routes to your existing Express app:

```javascript
const notificationService = require('../services/notificationService');

// List user's notifications
app.get('/notifications', authenticate, async (req, res) => {
  const { page = 0, limit = 20 } = req.query;
  
  const notifications = await notificationService.getUserNotifications(
    req.tenantId,
    req.userId,
    { page: parseInt(page), limit: parseInt(limit) }
  );
  
  const total = await notificationService.countUserNotifications(
    req.tenantId,
    req.userId
  );
  
  res.json({
    notifications,
    total,
    page: parseInt(page),
    limit: parseInt(limit),
    hasMore: (page + 1) * limit < total
  });
});

// Unread count (for badge)
app.get('/notifications/unread-count', authenticate, async (req, res) => {
  const count = await notificationService.countUnread(
    req.tenantId,
    req.userId
  );
  
  res.json({ unreadCount: count });
});

// Mark as read
app.patch('/notifications/:id/read', authenticate, async (req, res) => {
  const notification = await notificationService.markAsRead(
    req.params.id,
    req.tenantId,
    req.userId
  );
  
  res.json(notification);
});

// Mark all read
app.patch('/notifications/read-all', authenticate, async (req, res) => {
  const count = await notificationService.markAllAsRead(
    req.tenantId,
    req.userId
  );
  
  res.json({ markedAsRead: count });
});
```

---

## What You Keep vs. Redesign

### Keep (Minimal Changes)

- ✅ Your auth system (JWT, sessions, etc.)
- ✅ Your frontend framework (React, Vue, etc.)
- ✅ Your existing database tables (Users, Tenants, etc.)
- ✅ Your API structure and routing patterns
- ✅ Your deployment infrastructure

### Add (Isolated)

- **New table:** `notifications` (simple, append-only)
- **New service:** `notificationService` (encapsulated, reusable)
- **New endpoints:** 5 notification routes (orthogonal, no breaking changes)
- **New component:** `<NotificationBell />` (drop-in React component)
- **Notification triggers:** Calls in existing endpoint handlers (one-liners)

### Redesign (Only if scaling demands)

When notifications hit high volume (~100k/day):

1. **Message queue** (RabbitMQ, AWS SQS) instead of sync writes
2. **WebSocket/SSE** instead of polling
3. **Notification preferences** table (unsubscribe, delivery channels)
4. **Separate read replica** for notification queries (they're heavy)

But that's weeks away. Start simple.

---

## Implementation Checklist

```
□ Create notifications table (SQL migration)
□ Add indices on (tenant_id, user_id, created_at)
□ Build NotificationService class
□ Add notification endpoints to existing Express app
□ Audit all business logic endpoints for trigger points
□ Add notification.create() calls to top 5-10 event endpoints
□ Drop <NotificationBell /> component into header/layout
□ Test tenant isolation (unit + integration tests)
□ Deploy to staging, test end-to-end
□ Monitor: query performance, error rates, latency
□ Plan future: WebSocket upgrade, preferences UI, email digests
```

---

## Performance Considerations

### Query Performance
- **With indices:** 50 notifications in <10ms even at 100k rows
- **Polling:** 15-30 second intervals means ~3-5k requests/day per user
- **Unread count:** Cached separately, not recalculated per query

### Scalability Phases

**Phase 1 (Now):** Single database, polling
- Cost: Minimal
- Latency: 50-100ms
- Scale: 10k users

**Phase 2 (Months 2-3):** Read replica for notifications
- Cost: +$200/mo
- Latency: 20-50ms
- Scale: 100k users

**Phase 3 (Months 4+):** Message queue + WebSocket
- Cost: +$500/mo (Redis, queue service)
- Latency: <1s real-time
- Scale: 1M+ users

### Storage
- Assume 10 notifications per user per month
- 10k users × 10 notifications × 12 months = 1.2M rows
- At 500 bytes per row = 600 MB (negligible)

No archival needed for years.

---

## Testing Strategy

### Unit Tests
```javascript
// Test notification service in isolation
describe('NotificationService', () => {
  it('should prevent user from seeing other tenant notifications', async () => {
    const notif = await createNotification({ tenantId: 't2' });
    const visibility = await notificationService.getUserNotifications('t1', 'u1');
    expect(visibility.map(n => n.id)).not.toContain(notif.id);
  });
});
```

### Integration Tests
```javascript
// Test full flow: user invites member → notification appears
describe('Invite flow', () => {
  it('should create tenant-wide notification', async () => {
    const res = await request(app)
      .post('/teams/team1/members')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'new@example.com' });
    
    expect(res.status).toBe(201);
    
    // Check notification was created
    const notifs = await request(app)
      .get('/notifications')
      .set('Authorization', `Bearer ${token}`);
    
    expect(notifs.body.notifications).toContainEqual(
      expect.objectContaining({ type: 'user_invited' })
    );
  });
});
```

### Tenant Isolation Tests
```javascript
// Verify strict boundaries (most critical)
it('user cannot access other tenant notifications', async () => {
  const t1Token = jwt.sign({ tenantId: 't1', userId: 'u1' });
  const t2Token = jwt.sign({ tenantId: 't2', userId: 'u2' });
  
  // Create notif in t2
  await notificationService.create({ tenantId: 't2', /* ... */ });
  
  // Try to see it as t1 user
  const res = await request(app)
    .get('/notifications')
    .set('Authorization', `Bearer ${t1Token}`);
  
  expect(res.body.notifications).toHaveLength(0);
});
```

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Notification writes block requests | Queue + async workers |
| N+1 queries on listing | Single JOIN query + indices |
| Tenant isolation bug | Unit tests, DB constraints |
| Notification spam | Rate limiting, preference filters |
| Storage bloat | Append-only + archive job after 6mo |

---
 
