import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import logger from './logger';

/**
 * Initialize Sentry for error tracking and performance monitoring
 * Call this before any other middleware
 */
export const initSentry = (): void => {
  // Only initialize if DSN is provided
  if (!process.env.SENTRY_DSN) {
    logger.warn('Sentry DSN not configured, skipping Sentry initialization');
    return;
  }

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    integrations: [
      // Enable HTTP calls tracing
      Sentry.httpIntegration(),
      // Enable Express.js middleware tracing
      Sentry.expressIntegration(),
      // Enable profiling
      nodeProfilingIntegration(),
    ],
    // Performance Monitoring
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0, // Sample 10% in prod, 100% in dev
    // Profiling
    profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    // Release tracking
    release: process.env.npm_package_version,
    // Server name
    serverName: process.env.SERVER_NAME || 'todo-backend',
    // Debug mode in development
    debug: process.env.NODE_ENV === 'development',
    // Before send hook - filter sensitive data
    beforeSend(event, hint) {
      // Log errors to console in development
      if (process.env.NODE_ENV === 'development') {
        logger.error('Sentry event', {
          error: hint.originalException || hint.syntheticException,
          event,
        });
      }

      // Filter sensitive data from request
      if (event.request) {
        // Remove sensitive headers
        if (event.request.headers) {
          delete event.request.headers.authorization;
          delete event.request.headers.cookie;
        }
        // Remove sensitive query params
        if (event.request.query_string) {
          const queryString =
            typeof event.request.query_string === 'string' ? event.request.query_string : '';
          event.request.query_string = queryString.replace(/token=[^&]*/gi, 'token=[FILTERED]');
        }
      }

      return event;
    },
    // Ignore certain errors
    ignoreErrors: [
      // Browser extensions
      'top.GLOBALS',
      // Network errors
      'NetworkError',
      'Network request failed',
      // Random plugins/extensions
      "Can't find variable: ZiteReader",
      'jigsaw is not defined',
      'ComboSearch is not defined',
    ],
  });

  logger.info('Sentry initialized', {
    environment: process.env.NODE_ENV,
    release: process.env.npm_package_version,
  });
};

/**
 * Sentry request handler middleware
 * Must be the first middleware on the app
 */
export const sentryRequestHandler = Sentry.setupExpressErrorHandler;

/**
 * Manual error reporting to Sentry
 */
export const reportError = (error: Error, context?: Record<string, unknown>): void => {
  if (context) {
    Sentry.setContext('additional', context);
  }
  Sentry.captureException(error);
};

/**
 * Set user context for error tracking
 */
export const setSentryUser = (user: { id: string; email?: string; username?: string }): void => {
  Sentry.setUser(user);
};

/**
 * Clear user context
 */
export const clearSentryUser = (): void => {
  Sentry.setUser(null);
};

/**
 * Add breadcrumb for debugging
 */
export const addSentryBreadcrumb = (
  message: string,
  category: string,
  data?: Record<string, unknown>
): void => {
  Sentry.addBreadcrumb({
    message,
    category,
    level: 'info',
    data,
  });
};
