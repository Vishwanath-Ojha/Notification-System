/**
 * Middleware for extracting and validating tenant/user context from headers
 * 
 * In a real system, this would validate JWT tokens against a real auth provider.
 * For this exercise, we treat X-Tenant-Id and X-User-Id as trusted identity headers.
 */

/**
 * Extract tenant and user ID from request headers
 * Every request must include X-Tenant-Id and X-User-Id headers
 */
function extractContext(req, res, next) {
  const tenantId = req.headers['x-tenant-id'];
  const userId = req.headers['x-user-id'];
  
  if (!tenantId) {
    return res.status(400).json({
      error: 'Missing X-Tenant-Id header'
    });
  }
  
  if (!userId) {
    return res.status(400).json({
      error: 'Missing X-User-Id header'
    });
  }
  
  // Attach to request object for use in route handlers
  req.tenantId = tenantId;
  req.userId = userId;
  
  next();
}

module.exports = {
  extractContext
};
