# Notification System Frontend

Simple Next.js app showcasing the notification bell UI.

## Setup

```bash
npm install
npm run dev
```

Opens on http://localhost:3000

## Environment

If backend is on a different URL, set in `.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## Demo

Set your tenant/user via URL params:

```
http://localhost:3000?tenantId=t1&userId=u1
```

Or use the header/controls in the app to switch context.
