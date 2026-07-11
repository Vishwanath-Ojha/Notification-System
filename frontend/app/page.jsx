"use client";

import React, { useState, useEffect } from 'react';
import NotificationBell from '@/components/NotificationBell';
import './page.css';

export default function Home() {
  const [tenantId, setTenantId] = useState('t1');
  const [userId, setUserId] = useState('u1');
  const [apiUrl, setApiUrl] = useState(
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
);

  const handleTriggerEvent = async (scenario) => {
    try {
      const response = await fetch(`${apiUrl}/demo/trigger?scenario=${scenario}`, {
        method: 'POST',
        headers: {
          'X-Tenant-Id': tenantId,
          'X-User-Id': userId
        }
      });

      if (!response.ok) throw new Error('Failed to trigger event');
      
      const data = await response.json();
      alert(`✓ Triggered ${scenario}\nNotifications created: ${data.notifications.length}`);
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  };

  const handleResetDatabase = async () => {
    if (!window.confirm('Reset database to seed state?')) return;
    
    try {
      await fetch(`${apiUrl}/demo/reset`, {
        headers: {
          'X-Tenant-Id': tenantId,
          'X-User-Id': userId
        }
      });
      alert('✓ Database reset to seed state');
      window.location.reload();
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  };

  return (
    <div className="container">
      <header className="header">
        <div className="header-top">
          <h1>Notification System Demo</h1>
          <NotificationBell 
            tenantId={tenantId} 
            userId={userId}
            refreshInterval={15000}
          />
        </div>

        <div className="context-controls">
          <div className="control-group">
            <label>Tenant ID:</label>
            <input
              type="text"
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              placeholder="t1"
              className="input"
            />
          </div>

          <div className="control-group">
            <label>User ID:</label>
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="u1"
              className="input"
            />
          </div>

          <div className="control-group">
            <label>API URL:</label>
            <input
              type="text"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="http://localhost:3001"
              className="input"
            />
          </div>
        </div>

        <p className="context-info">
          You are logged in as <strong>{userId}</strong> in tenant <strong>{tenantId}</strong>
        </p>
      </header>

      <main className="main">
        <section className="section">
          <h2>Trigger Events</h2>
          <p className="section-description">
            These simulate real-world events that should create notifications:
          </p>
          
          <div className="button-group">
            <button 
              className="button button-primary"
              onClick={() => handleTriggerEvent('member_invited')}
            >
              👥 Member Invited
            </button>
            
            <button 
              className="button button-primary"
              onClick={() => handleTriggerEvent('creator_replied')}
            >
              💬 Creator Replied
            </button>

            <button 
              className="button button-primary"
              onClick={() => handleTriggerEvent('report_ready')}
            >
              📊 Report Ready
            </button>

            <button 
              className="button button-primary"
              onClick={() => handleTriggerEvent('deal_moved')}
            >
              📈 Deal Moved
            </button>
          </div>
        </section>

        <section className="section">
          <h2>Demo Scenarios</h2>
          
          <div className="scenario">
            <h3>🧪 Test Tenant Isolation</h3>
            <p>
              Try switching between <code>t1</code> and <code>t2</code> tenants, or between 
              <code>u1</code> and <code>u2</code> users. Notice:
            </p>
            <ul>
              <li>Users in t1 only see notifications from t1</li>
              <li>User <code>u1</code> sees notifications addressed to them</li>
              <li>Other users only see tenant-wide notifications</li>
              <li>Mark all/read buttons only affect visible notifications</li>
            </ul>
          </div>

          <div className="scenario">
            <h3>🔄 Suggested Interactions</h3>
            <ol>
              <li>Load as <code>t1:u1</code> — see initial seed notifications</li>
              <li>Click bell icon and mark some as read</li>
              <li>Switch to <code>t1:u2</code> — should only see tenant-wide notification</li>
              <li>Switch to <code>t2:u3</code> — completely different set</li>
              <li>Use trigger buttons to create new notifications in current context</li>
              <li>Clear browser cache or refresh to reload</li>
            </ol>
          </div>
        </section>

        <section className="section">
          <h2>Admin Controls</h2>
          <button 
            className="button button-secondary"
            onClick={handleResetDatabase}
          >
            🔄 Reset Database
          </button>
        </section>

        <section className="section info-section">
          <h2>How It Works</h2>
          <div className="info-box">
            <h3>Tenant Isolation</h3>
            <p>
              Every request includes <code>X-Tenant-Id</code> and <code>X-User-Id</code> headers.
              The backend enforces strict isolation — users can never see, count, or modify
              notifications from other tenants.
            </p>
          </div>

          <div className="info-box">
            <h3>Notification Visibility</h3>
            <p>
              <strong>Visible to user if:</strong>
            </p>
            <ul>
              <li>Their tenant matches the notification's tenantId, AND</li>
              <li>Either the notification is tenant-wide (userId=null) OR it's addressed to them</li>
            </ul>
          </div>

          <div className="info-box">
            <h3>Triggers</h3>
            <p>
              Notifications are created in response to events (team member invited, creator replied, etc.).
              This demonstrates that notification creation is decoupled from business logic—the pattern
              you'd use when integrating into an existing system.
            </p>
          </div>
        </section>
      </main>

      <footer className="footer">
        <p>Backend running on {apiUrl}</p>
        <p>Notifications poll every 15 seconds</p>
      </footer>
    </div>
  );
}
