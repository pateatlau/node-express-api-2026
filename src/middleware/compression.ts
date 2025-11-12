import compression from 'compression';
import { Request, Response } from 'express';

/**
 * Compression middleware configuration
 * Compresses response bodies for all requests
 */
export const compressionMiddleware = compression({
  // Compression level (0-9, higher = better compression but slower)
  level: 6,
  // Compression threshold - only compress if response is larger than this (in bytes)
  threshold: 1024, // 1KB
  // Filter function to determine if response should be compressed
  filter: (req: Request, res: Response) => {
    // Don't compress if the client doesn't support it
    if (req.headers['x-no-compression']) {
      return false;
    }

    // Don't compress event streams
    if (res.getHeader('Content-Type') === 'text/event-stream') {
      return false;
    }

    // Use compression's default filter for everything else
    return compression.filter(req, res);
  },
});
