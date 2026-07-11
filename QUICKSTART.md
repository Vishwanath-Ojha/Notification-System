# Quick Start Guide

Get everything running in just a second. Simply visit:- notification-system-vn-ojha.vercel.app to access the web application as it is deployed globally.

## To run it on your local machine:

## Prerequisites
- Node.js 18+ installed (https://nodejs.org)
- Two terminal windows open

## Step 1: Start Backend

```bash
cd backend
npm install
npm start
```

You should see:
```
Notification API running on http://localhost:3001
CORS enabled for http://localhost:3000
Headers required: X-Tenant-Id, X-User-Id
```

Leave this running.

## Step 2: Start Frontend (in a new terminal)

```bash
cd frontend
npm install
npm run dev
```

You should see:
```
Ready in X.XXs
○ Localhost: http://localhost:3000
```

Open http://localhost:3000 in your browser. You'll see the demo app.

## Step 3: Try It Out

### In the App:
1. **Click the bell icon 🔔** — opens notification dropdown
2. **See seed notifications** — should show 3 notifications for tenant t1, user u1
3. **Click "✓" button** on a notification to mark it read
4. **Use "Mark all read"** button to clear all at once
5. **Watch unread count** decrease

### Trigger Events:
1. Click **"👥 Member Invited"** button
2. A new notification appears in the bell
3. Try other buttons: **"💬 Creator Replied"**, **"📊 Report Ready"**, **"📈 Deal Moved"**

### Test Tenant Isolation:
1. Change **"Tenant ID"** input to `t2`
2. Change **"User ID"** input to `u3`
3. Click bell again — see completely different notifications (from t2)
4. Go back to `t1` / `u1` — original notifications return

This proves tenant isolation works.

## Testing Endpoints (Optional)

If you want to test the API directly (using curl or Postman):

### Get notifications
```bash
curl http://localhost:3001/notifications \
  -H "X-Tenant-Id: t1" \
  -H "X-User-Id: u1"
```

### Get unread count
```bash
curl http://localhost:3001/notifications/unread-count \
  -H "X-Tenant-Id: t1" \
  -H "X-User-Id: u1"
```

### Create a notification
```bash
curl -X POST http://localhost:3001/notifications \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: t1" \
  -H "X-User-Id: u1" \
  -d '{
    "type": "test",
    "title": "Test Notification",
    "body": "This is a test",
    "userId": "u1"
  }'
```

### Mark a notification as read
```bash
curl -X PATCH http://localhost:3001/notifications/<id>/read \
  -H "X-Tenant-Id: t1" \
  -H "X-User-Id: u1"
```

### Mark all as read
```bash
curl -X PATCH http://localhost:3001/notifications/read-all \
  -H "X-Tenant-Id: t1" \
  -H "X-User-Id: u1"
```

### Trigger an event
```bash
curl -X POST http://localhost:3001/demo/trigger?scenario=member_invited \
  -H "X-Tenant-Id: t1" \
  -H "X-User-Id: u1"
```

### Reset to seed data
```bash
curl http://localhost:3001/demo/reset \
  -H "X-Tenant-Id: t1" \
  -H "X-User-Id: u1"
```

## Run Tests

In the `backend` directory (with both servers running):
```bash
npm test
```

This runs the tenant isolation tests and verifies:
- Users can't see other tenant's notifications
- Can't mark other tenant's notifications as read
- Unread counts are isolated
- Mark-all doesn't leak across tenants

## Troubleshooting

### Port already in use?
```bash
# Kill process on port 3001
lsof -ti:3001 | xargs kill -9

# Or use different port
PORT=3002 npm start
```

### Backend not responding?
- Ensure backend is running on port 3001
- Check `X-Tenant-Id` and `X-User-Id` headers are present
- Restart backend: Ctrl+C then `npm start` again

### Frontend not loading?
- Clear browser cache (Ctrl+Shift+Delete)
- Hard refresh (Ctrl+Shift+R)
- Check frontend running on http://localhost:3000
- Check console for CORS errors

### Can't find notifications?
- Make sure you're using the same tenant/user that has notifications
- Default seed data uses `t1` tenant and `u1` user
- Try resetting: `curl http://localhost:3001/demo/reset -H "X-Tenant-Id: t1" -H "X-User-Id: u1"`

## Next Steps

1. **Read README.md** — for full documentation
2. **Read INTEGRATION.md** — for how to integrate into existing product
3. **Read FUTURE_WORK.md** — for what to build next
4. **Explore the code** — it's well-commented
5. **Run tests** — verify tenant isolation works
