import React from 'react';
import NotificationBell from '@/components/NotificationBell';
import './layout.css';

export const metadata = {
  title: 'Notification System',
  description: 'Full-stack notification system demo',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
