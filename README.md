# Full-Stack Notification System

A complete tenant-aware notification system for an AI-native CRM, demonstrating proper isolation, event-driven patterns, and end-to-end integration.

## Quick Start: Simmply visit notification-system-vn-ojha.vercel.app

### For running it locally follow these steps:-
### Prerequisites
- Node.js 18+ (https://nodejs.org)
- npm or yarn

### 1. Backend Setup

```bash
cd backend
npm install
npm start
```

Backend runs on `http://localhost:3001`

**Headers required on all requests:**
```
X-Tenant-Id: <string>    # Your tenant ID (e.g., "t1")
X-User-Id: <string>      # Your user ID (e.g., "u1")
```

### 2. Frontend Setup (in another terminal)

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:3000`

## What's Included

### Backend API

**Notification Shape:**
```json
{
  "id": "string",
  "tenantId": "string",
  "userId": "string | null",
  "type": "string",
  "title": "string",
  "body": "string",
  "read": "boolean",
  "createdAt": "ISO date string",
  "readAt": "ISO date string | null"
}
```

**Endpoints:**

- `POST /notifications` — Create a notification
  - Body: `{ type, title, body, userId? }`
  - Returns: Created notification

- `GET /notifications?page=0&limit=20` — List user's notifications
  - Returns: `{ notifications, total, page, limit, hasMore }`
  - Sorted: unread first, then newest first
  - Tenant & user isolation enforced

- `GET /notifications/unread-count` — Badge count
  - Returns: `{ unreadCount }`

- `PATCH /notifications/:id/read` — Mark one as read
  - Returns: Updated notification

- `PATCH /notifications/read-all` — Mark all visible as read
  - Returns: `{ markedAsRead: number }`

**Demo/Trigger Endpoints:**

- `POST /demo/trigger?scenario=<scenario>` — Create notifications from events
  - Scenarios: `member_invited`, `creator_replied`, `report_ready`, `deal_moved`

- `GET /demo/reset` — Reset database to seed state

### Frontend

- **Notification Bell** with:
  - Unread count badge
  - Dropdown showing recent notifications
  - Mark as read / Mark all read
  - Relative timestamps
  - Auto-polling every 15 seconds

- **Demo Controls:**
  - Switch tenant/user context
  - Trigger event scenarios
  - View notifications in real-time
  - Test tenant isolation

## Testing Tenant Isolation

Run the isolation tests (requires both backend and frontend to be running):

```bash
# In backend directory
npm install
npm test
```

The test suite verifies:
- ✅ User A in tenant 1 cannot see tenant 2's notifications
- ✅ Cannot mark another tenant's notifications as read
- ✅ User counters are tenant-isolated
- ✅ Mark-all doesn't leak across tenants
- ✅ New notifications respect tenant boundaries

## Seed Data

On startup, the backend loads 4 test notifications:

| ID  | Tenant | User | Type            | Read | Purpose                                  |
|-----|--------|------|-----------------|------|------------------------------------------|
| n1  | t1     | null | member_invited  | No   | Tenant-wide notification (all see it)    |
| n2  | t1     | u1   | new_reply       | No   | User-specific notification              |
| n3  | t1     | u1   | report_ready    | Yes  | User-specific, already read             |
| n4  | t2     | null | member_invited  | No   | Different tenant (isolated)              |

**Test with:**
- `?tenantId=t1&userId=u1` → sees n1, n2, n3 (not n4)
- `?tenantId=t1&userId=u2` → sees n1 only
- `?tenantId=t2&userId=u3` → sees n4 only

## Architecture

### Backend

```
backend/
├── src/
│   ├── index.js          # Express app & route handlers
│   ├── database.js       # In-memory notification store
│   ├── middleware.js     # Auth context extraction
│   └── triggers.js       # Event → notification logic
└── tests/
    └── tenant-isolation.test.js
```

**Key Design Decisions:**

1. **In-memory database** — for simplicity. In production, use PostgreSQL with proper indices on `(tenantId, userId)`.

2. **Trusted headers** — `X-Tenant-Id` and `X-User-Id` stand in for JWT tokens. Real auth would validate these against an identity provider.

3. **Trigger system** — `POST /demo/trigger` simulates how real events (user invited, message replied, etc.) would create notifications. In production, these would be called from:
   - Business logic event emitters
   - Message queue handlers (RabbitMQ, AWS SQS)
   - Webhook receivers
   - Cron jobs for scheduled actions

4. **Pagination** — simple offset-based for this demo. Cursor-based pagination recommended for high-volume systems.

### Frontend

```
frontend/
├── app/
│   ├── layout.jsx        # Root layout
│   └── page.jsx          # Demo page with controls
├── components/
│   ├── NotificationBell.jsx
│   └── NotificationBell.css
└── next.config.js
```

**Key Features:**

1. **Context controls** — switch tenant/user to test isolation
2. **Event triggers** — simulate real-world scenarios
3. **Bell component** — reusable, can be dropped into any React/Next.js app
4. **Polling** — fetches notifications every 15 seconds (WebSocket/SSE would be real-time upgrade)

## Integration into Existing Product

See [INTEGRATION.md](./INTEGRATION.md) for a detailed write-up on how to wire this into an existing CRM system.

**Short version:**
- Expose the notification creation API to your internal service layer
- Call it from business logic (after user invited, deal moved, message received, etc.)
- The frontend component integrates with any React/Next.js app
- Auth context flows from your existing JWT/session system
- Database migrations handle the 5 new fields + indices

## What I'd Do With More Time

1. **Real WebSocket/SSE** — true real-time instead of polling
2. **Database backend** — PostgreSQL with proper schema, migrations, indexing
3. **Notification preferences** — let users choose channels (in-app, email, SMS) and filter by type
4. **Batch operations** — mark multiple as read, soft-delete, archive
5. **Analytics** — track notification engagement (opened, clicked, ignored)
6. **Rich formatting** — support markdown/HTML in notification bodies with content security
7. **Notification history** — archive old notifications separately
8. **Internationalization** — template system with language strings
9. **Email digests** — batch notifications into daily/weekly summaries
10. **Integration tests** — end-to-end scenarios with real database
11. **Rate limiting** — prevent notification spam
12. **Error tracking** — Sentry/Rollbar integration for notification delivery failures

## File Structure

```
FullStackChallenge/
├── backend/
│   ├── package.json
│   ├── src/
│   │   ├── index.js
│   │   ├── database.js
│   │   ├── middleware.js
│   │   └── triggers.js
│   └── tests/
│       └── tenant-isolation.test.js
├── frontend/
│   ├── package.json
│   ├── next.config.js
│   ├── jsconfig.json
│   ├── app/
│   │   ├── layout.jsx
│   │   ├── layout.css
│   │   ├── page.jsx
│   │   └── page.css
│   └── components/
│       ├── NotificationBell.jsx
│       └── NotificationBell.css
└── README.md
```

## Local Development

### Terminal 1: Backend
```bash
cd backend
npm install
npm start
# Runs on http://localhost:3001
```

### Terminal 2: Frontend
```bash
cd frontend
npm install
npm run dev
# Runs on http://localhost:3000
```

### Terminal 3: Tests (after backend + frontend running)
```bash
cd backend
npm test
```

## API Examples

### Create a notification (backend trigger event)
```bash
curl -X POST http://localhost:3001/notifications \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: t1" \
  -H "X-User-Id: u1" \
  -d '{
    "type": "new_reply",
    "title": "Creator replied",
    "body": "Priya replied to your message",
    "userId": "u1"
  }'
```

### Get notifications
```bash
curl http://localhost:3001/notifications \
  -H "X-Tenant-Id: t1" \
  -H "X-User-Id: u1"
```

### Mark all as read
```bash
curl -X PATCH http://localhost:3001/notifications/read-all \
  -H "X-Tenant-Id: t1" \
  -H "X-User-Id: u1"
```

### Trigger a demo event
```bash
curl -X POST http://localhost:3001/demo/trigger?scenario=member_invited \
  -H "X-Tenant-Id: t1" \
  -H "X-User-Id: u1"
```

## Compliance & Security Notes

- **Tenant Isolation:** Strictly enforced at the database query level. Every query filters by `tenantId` and validates the calling user's access.
- **CORS:** Configured for localhost dev; update to production domain.
- **Auth:** Uses header-based context (stands in for real JWT). Always validate in production.
- **Input validation:** Basic checks on required fields. Add sanitization for production.

---
 
