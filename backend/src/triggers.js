/**
 * Trigger system: simulates real-world events that should create notifications
 * 
 * In a real system, these would be called from:
 * - Event emitters in response to business logic
 * - Message queues (like RabbitMQ, SQS)
 * - Webhooks from third-party systems
 * - Cron jobs for scheduled actions
 * 
 * The key point: notifications are created in response to decoupled events,
 * not directly embedded in business logic.
 */

const db = require('./database');

/**
 * Create notifications for a triggered event
 * @param {string} tenantId - The tenant ID
 * @param {string} userId - The user ID triggering the action
 * @param {string} scenario - The scenario to trigger
 * @returns {Array} Array of created notifications
 */
async function createTriggeredNotifications(tenantId, userId, scenario) {
  const notifications = [];
  
  switch (scenario) {
    case 'member_invited': {
      const notification = await db.createNotification({
        tenantId,
        userId: null,
        type: 'member_invited',
        title: 'New team member invited',
        body: 'A new team member has been invited to join your agency',
        createdAt: new Date().toISOString()
      });
      notifications.push(notification);
      break;
    }
    
    case 'creator_replied': {
      const notification = await db.createNotification({
        tenantId,
        userId,
        type: 'new_reply',
        title: 'Creator replied',
        body: 'A creator replied to your outreach message',
        createdAt: new Date().toISOString()
      });
      notifications.push(notification);
      break;
    }
    
    case 'report_ready': {
      const notification = await db.createNotification({
        tenantId,
        userId,
        type: 'report_ready',
        title: 'Report ready',
        body: 'Your report is now available to view',
        createdAt: new Date().toISOString()
      });
      notifications.push(notification);
      break;
    }
    
    case 'deal_moved': {
      const notification = await db.createNotification({
        tenantId,
        userId: null,
        type: 'deal_moved',
        title: 'Deal stage updated',
        body: 'A deal has moved to a new stage in the pipeline',
        createdAt: new Date().toISOString()
      });
      notifications.push(notification);
      break;
    }
    
    default:
      throw new Error(`Unknown scenario: ${scenario}`);
  }
  
  return notifications;
}

module.exports = {
  createTriggeredNotifications
};
