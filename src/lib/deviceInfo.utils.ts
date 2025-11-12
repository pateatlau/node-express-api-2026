/**
 * Device Information Utilities
 * Extract device, browser, and OS information from User-Agent
 */

import type { DeviceInfo } from '../services/session.service.js';

/**
 * Parse User-Agent string to extract device information
 */
export function parseUserAgent(userAgent: string): DeviceInfo {
  const ua = userAgent.toLowerCase();

  // Detect browser
  let browser = 'Unknown Browser';
  if (ua.includes('edg/')) {
    const version = ua.match(/edg\/([\d.]+)/)?.[1] || '';
    browser = `Edge ${version.split('.')[0]}`;
  } else if (ua.includes('chrome/') && !ua.includes('edg/')) {
    const version = ua.match(/chrome\/([\d.]+)/)?.[1] || '';
    browser = `Chrome ${version.split('.')[0]}`;
  } else if (ua.includes('safari/') && !ua.includes('chrome/')) {
    const version = ua.match(/version\/([\d.]+)/)?.[1] || '';
    browser = `Safari ${version.split('.')[0]}`;
  } else if (ua.includes('firefox/')) {
    const version = ua.match(/firefox\/([\d.]+)/)?.[1] || '';
    browser = `Firefox ${version.split('.')[0]}`;
  } else if (ua.includes('opera/') || ua.includes('opr/')) {
    const version = ua.match(/(?:opera|opr)\/([\d.]+)/)?.[1] || '';
    browser = `Opera ${version.split('.')[0]}`;
  }

  // Detect OS
  let os = 'Unknown OS';
  if (ua.includes('windows nt 10.0')) {
    os = 'Windows 10/11';
  } else if (ua.includes('windows nt 6.3')) {
    os = 'Windows 8.1';
  } else if (ua.includes('windows nt 6.2')) {
    os = 'Windows 8';
  } else if (ua.includes('windows nt 6.1')) {
    os = 'Windows 7';
  } else if (ua.includes('windows')) {
    os = 'Windows';
  } else if (ua.includes('mac os x')) {
    const version = ua.match(/mac os x ([\d_]+)/)?.[1]?.replace(/_/g, '.') || '';
    os = version ? `macOS ${version}` : 'macOS';
  } else if (ua.includes('android')) {
    const version = ua.match(/android ([\d.]+)/)?.[1] || '';
    os = version ? `Android ${version}` : 'Android';
  } else if (ua.includes('iphone') || ua.includes('ipad')) {
    const version = ua.match(/os ([\d_]+)/)?.[1]?.replace(/_/g, '.') || '';
    os = version ? `iOS ${version}` : 'iOS';
  } else if (ua.includes('linux')) {
    os = 'Linux';
  }

  // Detect device type
  let device = 'Desktop';
  if (ua.includes('mobile') || ua.includes('android')) {
    device = 'Mobile';
  } else if (ua.includes('tablet') || ua.includes('ipad')) {
    device = 'Tablet';
  }

  return {
    browser,
    os,
    device,
  };
}

/**
 * Get approximate location from IP address (simplified)
 * In production, integrate with a geolocation service like MaxMind or IPStack
 */
export function getLocationFromIP(ipAddress?: string): string {
  // For now, return 'Unknown Location'
  // In production, use a geolocation API
  if (!ipAddress) {
    return 'Unknown Location';
  }

  // Placeholder for local/private IPs
  if (
    ipAddress.startsWith('127.') ||
    ipAddress.startsWith('192.168.') ||
    ipAddress.startsWith('10.') ||
    ipAddress === '::1'
  ) {
    return 'Local Network';
  }

  return 'Unknown Location';
}

/**
 * Get device info from request
 */
export function getDeviceInfoFromRequest(req: {
  headers: { 'user-agent'?: string };
  ip?: string;
}): DeviceInfo {
  const userAgent = req.headers['user-agent'] || 'Unknown';
  const deviceInfo = parseUserAgent(userAgent);
  const location = getLocationFromIP(req.ip);

  return {
    ...deviceInfo,
    location,
  };
}
