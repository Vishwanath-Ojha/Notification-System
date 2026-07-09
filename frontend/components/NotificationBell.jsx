"use client";

import React, { useState, useEffect } from 'react';
import './NotificationBell.css';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function NotificationBell({ tenantId, userId, refreshInterval = 20000 }) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  // Fetch notifications
  async function fetchNotifications() {
    try {
      const response = await fetch(`${API_URL}/notifications?limit=50`, {
        headers: {
          'X-Tenant-Id': tenantId,
          'X-User-Id': userId
        }
      });

      if (!response.ok) throw new Error('Failed to fetch');
      
      const data = await response.json();
      setNotifications(data.notifications || []);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  }

  // Fetch unread count
  async function fetchUnreadCount() {
    try {
      const response = await fetch(`${API_URL}/notifications/unread-count`, {
        headers: {
          'X-Tenant-Id': tenantId,
          'X-User-Id': userId
        }
      });

      if (!response.ok) throw new Error('Failed to fetch');
      
      const data = await response.json();
      setUnreadCount(data.unreadCount || 0);
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  }

  // Mark notification as read
  async function markAsRead(notificationId) {
    try {
      const response = await fetch(`${API_URL}/notifications/${notificationId}/read`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Id': tenantId,
          'X-User-Id': userId
        }
      });

      if (!response.ok) throw new Error('Failed to mark as read');
      
      // Update local state
      setNotifications(notifications.map(n => 
        n.id === notificationId ? { ...n, read: true, readAt: new Date().toISOString() } : n
      ));
      
      // Refresh unread count
      await fetchUnreadCount();
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  }

  // Mark all as read
  async function markAllAsRead() {
    try {
      const response = await fetch(`${API_URL}/notifications/read-all`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Id': tenantId,
          'X-User-Id': userId
        }
      });

      if (!response.ok) throw new Error('Failed to mark all as read');
      
      // Update local state
      setNotifications(notifications.map(n => ({
        ...n,
        read: true,
        readAt: new Date().toISOString()
      })));
      
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  }

  // Format relative time
  function formatTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }

  // Initial and periodic fetch
  useEffect(() => {
    if (!tenantId || !userId) return;

    fetchNotifications();
    fetchUnreadCount();

    const interval = setInterval(() => {
      fetchUnreadCount();
      fetchNotifications();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [tenantId, userId, refreshInterval]);

  if (!tenantId || !userId) {
    return <div className="notification-bell-placeholder">Configure tenant/user to enable</div>;
  }

  return (
    <div className="notification-bell">
      <button 
        className="bell-button"
        onClick={() => setIsOpen(!isOpen)}
        title={`${unreadCount} unread notifications`}
      >
        <span className="bell-icon">🔔</span>
        {unreadCount > 0 && (
          <span className="badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <div className="notification-panel">
          <div className="panel-header">
            <h3>Notifications</h3>
            {unreadCount > 0 && (
              <button 
                className="mark-all-button"
                onClick={markAllAsRead}
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="notification-list">
            {notifications.length === 0 ? (
              <div className="empty-state">No notifications</div>
            ) : (
              notifications.map(notification => (
                <div 
                  key={notification.id}
                  className={`notification-item ${notification.read ? 'read' : 'unread'}`}
                >
                  <div className="notification-content">
                    <div className="notification-header">
                      <h4>{notification.title}</h4>
                      <span className="notification-time">
                        {formatTime(notification.createdAt)}
                      </span>
                    </div>
                    <p>{notification.body}</p>
                    <span className="notification-type">{notification.type}</span>
                  </div>
                  
                  {!notification.read && (
                    <button
                      className="mark-read-button"
                      onClick={() => markAsRead(notification.id)}
                      title="Mark as read"
                    >
                      ✓
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
