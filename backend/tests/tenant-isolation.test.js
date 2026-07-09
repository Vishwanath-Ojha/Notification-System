/**
 * Tenant Isolation Tests
 * 
 * Ensures that a user from one tenant cannot access, read, or modify
 * notifications from another tenant.
 */

import assert from 'assert';
import http from 'http';
import { createServer } from 'http';

// We'll need to start the app
const appPath = './src/index.js';

/**
 * Helper to make HTTP requests
 */
function makeRequest(method, path, tenantId, userId, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-Id': tenantId,
        'X-User-Id': userId
      }
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            body: data ? JSON.parse(data) : null
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            body: data
          });
        }
      });
    });
    
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  console.log('Starting tenant isolation tests...\n');
  
  try {
    // Reset to seed state
    await makeRequest('GET', '/demo/reset', 't1', 'u1');
    console.log('✓ Database reset to seed state');
    
    // TEST 1: User from tenant t1 should not see notifications from tenant t2
    console.log('\nTEST 1: Cross-tenant visibility');
    const t1Response = await makeRequest('GET', '/notifications', 't1', 'u1');
    const t1NotificationIds = t1Response.body.notifications.map(n => n.id);
    
    assert(!t1NotificationIds.includes('n4'), 'User t1:u1 should not see n4 from tenant t2');
    assert(t1NotificationIds.includes('n1'), 'User t1:u1 should see n1 (tenant-wide)');
    assert(t1NotificationIds.includes('n2'), 'User t1:u1 should see n2 (addressed to them)');
    console.log('✓ Tenant t1 user cannot see tenant t2 notifications');
    
    // TEST 2: Attempting to mark a notification from another tenant should fail
    console.log('\nTEST 2: Cross-tenant modification attempt');
    const markResponse = await makeRequest('PATCH', '/notifications/n4/read', 't1', 'u1');
    assert.strictEqual(markResponse.status, 404, 'Should return 404 for notification from another tenant');
    console.log('✓ Cannot mark notification from different tenant as read (404)');
    
    // TEST 3: Different user in same tenant SHOULD see tenant-wide notifications
    console.log('\nTEST 3: Intra-tenant visibility (different user)');
    const differentUserResponse = await makeRequest('GET', '/notifications', 't1', 'u2');
    const differentUserIds = differentUserResponse.body.notifications.map(n => n.id);
    
    // u2 should see n1 (tenant-wide) but NOT n2 or n3 (addressed to u1) or n4 (different tenant)
    assert(differentUserIds.includes('n1'), 'User t1:u2 should see n1 (tenant-wide)');
    assert(!differentUserIds.includes('n2'), 'User t1:u2 should not see n2 (addressed to u1)');
    assert(!differentUserIds.includes('n3'), 'User t1:u2 should not see n3 (addressed to u1)');
    assert(!differentUserIds.includes('n4'), 'User t1:u2 should not see n4 (different tenant)');
    console.log('✓ Different user in same tenant sees only tenant-wide and their own notifications');
    
    // TEST 4: Unread count is tenant-isolated
    console.log('\nTEST 4: Unread count isolation');
    const t1UnreadResponse = await makeRequest('GET', '/notifications/unread-count', 't1', 'u1');
    const t2UnreadResponse = await makeRequest('GET', '/notifications/unread-count', 't2', 'u2');
    
    // t1:u1 should have unread: n1, n2 (2 unread)
    assert.strictEqual(t1UnreadResponse.body.unreadCount, 2, 'Tenant t1:u1 should have 2 unread notifications');
    // t2:u2 should have unread: n4 (1 unread, but u2 wasn't invited so they see only tenant-wide)
    assert.strictEqual(t2UnreadResponse.body.unreadCount, 1, 'Tenant t2:u2 should have 1 unread notification');
    console.log('✓ Unread counts are correctly isolated by tenant');
    
    // TEST 5: Marking all as read should not affect other tenants
    console.log('\nTEST 5: Mark-all isolation');
    await makeRequest('PATCH', '/notifications/read-all', 't1', 'u1');
    
    const t1UnreadAfter = await makeRequest('GET', '/notifications/unread-count', 't1', 'u1');
    const t2UnreadAfter = await makeRequest('GET', '/notifications/unread-count', 't2', 'u2');
    
    assert.strictEqual(t1UnreadAfter.body.unreadCount, 0, 'After mark-all, t1:u1 should have 0 unread');
    assert.strictEqual(t2UnreadAfter.body.unreadCount, 1, 'Mark-all in t1 should not affect t2 notifications');
    console.log('✓ Mark-all-as-read does not affect other tenants');
    
    // TEST 6: Creating notifications respects tenant context
    console.log('\nTEST 6: Tenant context on creation');
    const createResponse = await makeRequest('POST', '/notifications', 't2', 'u3', {
      type: 'test_notification',
      title: 'Test',
      body: 'Testing tenant isolation on creation',
      userId: null
    });
    
    const newNotificationId = createResponse.body.id;
    const viewAsT2 = await makeRequest('GET', '/notifications', 't2', 'u3');
    const viewAsT1 = await makeRequest('GET', '/notifications', 't1', 'u1');
    
    const t2Ids = viewAsT2.body.notifications.map(n => n.id);
    const t1Ids = viewAsT1.body.notifications.map(n => n.id);
    
    assert(t2Ids.includes(newNotificationId), 'New notification should be visible in tenant t2');
    assert(!t1Ids.includes(newNotificationId), 'New notification should not be visible in tenant t1');
    console.log('✓ Newly created notifications respect tenant boundaries');
    
    console.log('\n✅ All tenant isolation tests passed!');
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Wait a moment for server to start, then run tests
setTimeout(runTests, 1000);
