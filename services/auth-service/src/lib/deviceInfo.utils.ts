/**
 * Device Info Utilities
 * Extract device information from HTTP requests
 */

import UAParser from 'ua-parser-js';
import type { Request } from 'express';

export interface DeviceInfo {
  browser: string;
  os: string;
  device: string;
  deviceType: string;
  userAgent: string;
}

/**
 * Extract device information from request
 */
export function getDeviceInfoFromRequest(req: Request): DeviceInfo {
  const userAgent = req.headers['user-agent'] || 'Unknown';
  const parser = new UAParser(userAgent);

  const browser = parser.getBrowser();
  const os = parser.getOS();
  const device = parser.getDevice();

  return {
    browser: browser.name || 'Unknown',
    os: os.name || 'Unknown',
    device: device.model || 'Desktop',
    deviceType: device.type || 'desktop',
    userAgent,
  };
}
