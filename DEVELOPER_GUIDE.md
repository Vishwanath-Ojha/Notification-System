# Codebase Walkthrough

Welcome! Here's how the notification system is organized and how it all works together.

## Backend Directory Structure

```
backend/
├── src/
│   ├── index.js          # Main Express app + Route handlers
│   ├── database.js       # In-memory notification store
│   ├── middleware.js     # Auth context extraction
│   └── triggers.js       # Event → Notification conversion
├── tests/
│   └── tenant-isolation.test.js  # Security tests
└── package.json
```

### src/index.js (Main Server)
**Responsibilities:**
- Create Express app
- Setup CORS middleware
- Extract tenant/user context
- Define all 7 HTTP routes (5 core + 2 demo)
- Listen on port 3001

**Key routes:**
```javascript
POST   /notifications              // Create
GET    /notifications              // List (paginated)
GET    /notifications/unread-count // Count for badge
PATCH  /notifications/:id/read     // Mark one
PATCH  /notifications/read-all     // Mark all
POST   /demo/trigger               // Event simulator
GET    /demo/reset                 // Reset for testing
```

**Authentication:**
Middleware extracts `X-Tenant-Id` and `X-User-Id` headers on every request.
These represent the calling user's identity.

### src/database.js (Data Store)
**Responsibilities:**
- Store notifications in memory (with seed data)
- Query notifications by tenant/user
- Enforce tenant isolation at query time
- Provide CRUD operations

**Key functions:**
```javascript
createNotification()           // POST /notifications
getUserNotifications()         // GET /notifications
getUnreadCount()              // GET /notifications/unread-count
getNotificationById()         // Fetch + verify tenant
markNotificationAsRead()      // PATCH /notifications/:id/read
markAllNotificationsAsRead()  // PATCH /notifications/read-all
getAllNotifications()         // For testing
resetDatabase()               // For testing
```

**Critical isolation logic:**
Every function checks `tenantId` matches the requesting user's tenant.
Never returns data from different tenants.

**Seed data:** 4 notifications on startup
- n1, n2, n3 belong to tenant t1
- n4 belongs to tenant t2
- Tests use this to verify isolation

### src/middleware.js (Auth Context)
**Responsibilities:**
- Extract tenant/user identity from headers
- Validate required headers present
- Attach to request object for route handlers

**Flow:**
```
Request with headers
    ↓
extractContext()
    ↓
Validate X-Tenant-Id present → ✓
    ↓
Validate X-User-Id present → ✓
    ↓
req.tenantId = X-Tenant-Id
req.userId = X-User-Id
    ↓
Next middleware/route
```

**Note:** In production, this would call `jwt.verify()` instead of treating headers as trusted.

### src/triggers.js (Event System)
**Responsibilities:**
- Convert business events into notifications
- Decouple event handling from notification creation
- Define event scenario handlers

**Scenarios:**
```javascript
member_invited    // Team member was invited
creator_replied   // Creator replied to message
report_ready      // Generated report is available
deal_moved        // Deal moved to new stage
```

**Pattern:**
```javascript
user invites member → POST /demo/trigger?scenario=member_invited
    ↓
createTriggeredNotifications() called
    ↓
Calls db.createNotification() with appropriate data
    ↓
Notification appears in user's feed
```

**Production use:** Replace `/demo/trigger` endpoint with calls from:
- User invitation handler
- Message received handler
- Report generation job
- Deal workflow automation

### backend/tests/tenant-isolation.test.js (Security Tests)
**Responsibilities:**
- Verify strict tenant isolation
- Prove users can't access other tenant data
- Prove modification attempts are blocked
- Prove counts are isolated

**Tests verify:**
```
TEST 1: Cross-tenant visibility blocked
    t1:u1 requests notifications → doesn't see t2 notifications ✓

TEST 2: Cross-tenant modification blocked
    t1:u1 tries to mark t2 notification as read → 404 ✓

TEST 3: Different user in same tenant
    t1:u2 only sees tenant-wide (not user-specific to u1) ✓

TEST 4: Unread count isolation
    t1 and t2 have separate unread counts ✓

TEST 5: Mark-all doesn't leak
    t1 marks all read, t2's count unchanged ✓

TEST 6: Creation respects tenant
    New notification stays in its tenant ✓
```

**Run with:** `npm test` (needs both servers running)

---

## Frontend Directory Structure

```
frontend/
├── app/
│   ├── layout.jsx         # Root layout wrapper
│   ├── layout.css         # Global styles
│   ├── page.jsx           # Main demo page
│   └── page.css           # Page-specific styles
├── components/
│   ├── NotificationBell.jsx    # Reusable bell component
│   └── NotificationBell.css    # Bell styles
├── next.config.js         # Next.js config
├── jsconfig.json          # Path aliases (@/components)
└── package.json
```

### app/page.jsx (Main Demo Page)
**Responsibilities:**
- Render context controls (tenant/user/API URL)
- Show trigger buttons for events
- Display demo scenarios and instructions
- Handle reset database
- Mount NotificationBell component

**Key sections:**
```jsx
1. Header with bell icon
2. Context controls (tenant, user, API URL inputs)
3. Trigger buttons (member_invited, creator_replied, etc.)
4. Demo scenarios explanation
5. Admin controls
6. Info boxes explaining how it works
7. NotificationBell component
```

**Interaction flow:**
```
User changes tenant → setTenantId() → re-render
User clicks trigger button → handleTriggerEvent() → fetch /demo/trigger
User clicks bell → opens NotificationBell component
```

### components/NotificationBell.jsx (Reusable Component)
**Responsibilities:**
- Display bell icon with badge
- Fetch notifications on mount + periodically
- Render dropdown panel with notifications
- Handle mark-as-read actions
- Format relative timestamps

**Key functions:**
```javascript
fetchNotifications()           // GET /notifications
fetchUnreadCount()            // GET /notifications/unread-count
markAsRead(id)               // PATCH /notifications/{id}/read
markAllAsRead()              // PATCH /notifications/read-all
formatTime(dateString)       // "2h ago" format
```

**Polling:**
```javascript
useEffect(() => {
  fetchNotifications()
  fetchUnreadCount()
  
  // Poll every 15 seconds
  const interval = setInterval(() => {
    fetchUnreadCount()
    fetchNotifications()
  }, 15000)
  
  return () => clearInterval(interval)
}, [tenantId, userId])
```

**API calls include headers:**
```javascript
fetch(url, {
  headers: {
    'X-Tenant-Id': tenantId,
    'X-User-Id': userId
  }
})
```

### components/NotificationBell.css (Styling)
**Layout:**
- Bell button with hover state
- Badge positioned at top-right
- Dropdown panel (400px wide)
- Notification list with scrolling
- Unread items highlighted in light blue

**Key classes:**
```css
.bell-button          /* Bell icon */
.badge                /* Unread count */
.notification-panel   /* Dropdown */
.notification-item    /* Each notification */
.notification-item.unread  /* Highlight */
.mark-read-button     /* Per-item action */
.mark-all-button      /* Global action */
```

### styles (page.css, layout.css)
**Responsibilities:**
- Global typography and colors
- Grid layouts
- Form styling
- Responsive design
- Scroll bar customization

---

## Data Flow Diagrams

### Creating a Notification

```
Frontend: Click "Member Invited" button
    ↓
handleTriggerEvent('member_invited')
    ↓
POST /demo/trigger?scenario=member_invited
    ├─ Header: X-Tenant-Id: t1
    ├─ Header: X-User-Id: u1
    ↓
Backend: POST /demo/trigger
    ↓
extractContext middleware
    ├─ req.tenantId = 't1'
    ├─ req.userId = 'u1'
    ↓
createTriggeredNotifications('t1', 'u1', 'member_invited')
    ↓
triggers.js handles scenario
    ├─ type: 'member_invited'
    ├─ tenantId: 't1'
    ├─ userId: null (tenant-wide)
    ↓
db.createNotification()
    ├─ Store in memory
    ├─ Generate ID
    ├─ Return to client
    ↓
Frontend receives notification
    ↓
Next poll discovers new notification
    ├─ setNotifications([newNotif, ...rest])
    ├─ setUnreadCount(count + 1)
    ↓
Bell badge updates, new item in dropdown
```

### Marking as Read

```
Frontend: Click "✓" button on notification
    ↓
markAsRead(notificationId)
    ↓
PATCH /notifications/{id}/read
    ├─ Header: X-Tenant-Id: t1
    ├─ Header: X-User-Id: u1
    ↓
Backend: PATCH /notifications/:id/read
    ↓
extractContext middleware
    ↓
db.markNotificationAsRead(id, tenantId)
    ├─ Fetch notification
    ├─ Verify tenantId matches (isolation check!)
    ├─ If different → return null
    ├─ If match → set read=true, readAt=now
    ├─ Return updated notification
    ↓
Backend returns updated notification
    ↓
Frontend updates local state
    ├─ setNotifications(notifications.map(n => 
         n.id === id ? {...n, read: true} : n
       ))
    ├─ setUnreadCount(count - 1)
    ↓
UI updates: notification grays out, badge decreases
```

### Cross-Tenant Isolation Block

```
Attacker in t1:u1 tries to access t2:n4
    ↓
PATCH /notifications/n4/read
    ├─ Header: X-Tenant-Id: t1
    ├─ Header: X-User-Id: u1
    ↓
Backend: PATCH /notifications/:id/read
    ↓
extractContext
    ├─ req.tenantId = 't1'
    ↓
db.markNotificationAsRead('n4', 't1')
    ├─ notification = db.find(id === 'n4')
    ├─ Find returns: {id: 'n4', tenantId: 't2', ...}
    ├─ Check: notification.tenantId ('t2') !== req.tenantId ('t1')
    ├─ Isolation check fails!
    ├─ Return null
    ↓
Backend handler sees null
    ├─ res.status(404).json({error: 'Not found'})
    ↓
Frontend receives 404
```

---

## File Dependencies

### Backend
```
index.js
├─ middleware.js (extractContext)
├─ database.js (CRUD operations)
│  └─ triggers.js (createTriggeredNotifications)
└─ express (HTTP server)
```

### Frontend
```
layout.jsx
└─ page.jsx
    ├─ NotificationBell.jsx
    │  └─ NotificationBell.css
    ├─ page.css
    └─ fetch (browser API)
```

---

## Adding a New Notification Type

**TL;DR:** 3 files, ~15 lines of code

### Step 1: Add trigger scenario (backend/src/triggers.js)
```javascript
case 'message_archived': {
  const notification = db.createNotification({
    tenantId,
    userId: null,
    type: 'message_archived',
    title: 'Message archived',
    body: `An important message was archived`,
  });
  notifications.push(notification);
  break;
}
```

### Step 2: Add trigger button (frontend/app/page.jsx)
```jsx
<button 
  className="button button-primary"
  onClick={() => handleTriggerEvent('message_archived')}
>
  📁 Message Archived
</button>
```

### Step 3: Test it
- Run frontend
- Click new button
- Watch notification appear
- Switch tenants to verify isolation

Done! New notification type integrated.

---

## Common Tasks

### Change polling interval
File: `frontend/components/NotificationBell.jsx`
```javascript
useEffect(() => {
  // ...
  const interval = setInterval(() => {
    // Change 15000 to 30000 for 30 seconds
    // Change to 5000 for 5 seconds
  }, 15000)  // ← HERE
}, [tenantId, userId])
```

### Reset to production-like setup
File: `backend/src/database.js`
Replace in-memory store with:
```javascript
const db = require('knex')({
  client: 'postgres',
  connection: process.env.DATABASE_URL
})
```

### Change unread sorting order
File: `backend/src/database.js`, `getUserNotifications()` function
```javascript
.sort((a, b) => {
  // Change to: newest first only (ignore read status)
  return new Date(b.createdAt) - new Date(a.createdAt);
})
```

### Add email notifications
File: Create `backend/src/emailService.js`
```javascript
async function sendNotificationEmail(userId, notification) {
  await sendEmail(userId, {
    subject: notification.title,
    body: notification.body
  });
}
```

Then call in `database.js` after creating notification.

---

## Debugging Tips

**Frontend notifications not appearing?**
1. Check browser console for fetch errors
2. Verify backend running on port 3001
3. Check X-Tenant-Id and X-User-Id headers in Network tab
4. Try clicking "refresh" or changing tenant ID

**Backend not starting?**
1. Ensure port 3001 is free
2. Check node version: `node --version` (need 18+)
3. Check npm installed: `npm --version`
4. Try: `npm install && npm start`

**Tests failing?**
1. Both frontend and backend must be running
2. Check backend responding: `curl http://localhost:3001/demo/reset -H "X-Tenant-Id: t1" -H "X-User-Id: u1"`
3. Check database reset: `npm test -- --verbose`

**Tenant isolation broken?**
1. Check database.js queries filtering by tenantId
2. Each function must verify tenant matches
3. Review tests to understand expectations
4. Search for `tenantId` in database.js

---

## Next Steps for Development

1. **Understand the flow:** Follow a notification creation from trigger to UI
2. **Read the code:** All files are well-commented
3. **Break something:** Remove an isolation check, see test fail
4. **Extend it:** Add a 5th notification type

All code has comments. Start with `backend/src/index.js`.
