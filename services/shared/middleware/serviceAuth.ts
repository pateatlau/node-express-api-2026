import { Request, Response, NextFunction } from 'express';

/**
 * Service-to-service authentication middleware
 * Validates internal service API keys for inter-service communication
 */

const SERVICE_API_KEY = process.env.SERVICE_API_KEY || 'dev-service-key-change-in-production';

/**
 * Middleware to verify service-to-service requests
 * Checks for X-Service-Key header
 */
export function authenticateService(req: Request, res: Response, next: NextFunction): void {
  const serviceKey = req.headers['x-service-key'];

  if (!serviceKey || serviceKey !== SERVICE_API_KEY) {
    res.status(403).json({
      success: false,
      message: 'Invalid service credentials',
    });
    return;
  }

  next();
}

/**
 * Get service API key for making requests to other services
 */
export function getServiceApiKey(): string {
  return SERVICE_API_KEY;
}
