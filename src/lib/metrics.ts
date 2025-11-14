import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

// Create a Registry to register the metrics
export const register = new Registry();

// Add default metrics (CPU, memory, event loop, etc.)
collectDefaultMetrics({
  register,
  prefix: 'nodejs_',
  gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
});

// ============================================================================
// HTTP Metrics
// ============================================================================

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register],
});

export const httpRequestTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

export const httpRequestErrors = new Counter({
  name: 'http_request_errors_total',
  help: 'Total number of HTTP request errors',
  labelNames: ['method', 'route', 'error_type'],
  registers: [register],
});

export const httpActiveRequests = new Gauge({
  name: 'http_active_requests',
  help: 'Number of active HTTP requests',
  labelNames: ['method'],
  registers: [register],
});

// ============================================================================
// Authentication Metrics
// ============================================================================

export const authOperations = new Counter({
  name: 'auth_operations_total',
  help: 'Total number of authentication operations',
  labelNames: ['operation', 'status'], // operation: signup, login, refresh, logout | status: success, failure
  registers: [register],
});

export const activeSessions = new Gauge({
  name: 'auth_active_sessions',
  help: 'Number of currently active user sessions',
  registers: [register],
});

export const tokenGeneration = new Counter({
  name: 'auth_tokens_generated_total',
  help: 'Total number of JWT tokens generated',
  labelNames: ['token_type'], // token_type: access, refresh
  registers: [register],
});

export const tokenValidation = new Counter({
  name: 'auth_tokens_validated_total',
  help: 'Total number of JWT token validations',
  labelNames: ['status'], // status: valid, expired, invalid
  registers: [register],
});

export const passwordHashDuration = new Histogram({
  name: 'auth_password_hash_duration_seconds',
  help: 'Duration of password hashing operations',
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2],
  registers: [register],
});

// ============================================================================
// Todo Operations Metrics
// ============================================================================

export const todoOperations = new Counter({
  name: 'todo_operations_total',
  help: 'Total number of todo operations',
  labelNames: ['operation', 'status'], // operation: create, read, update, delete, toggle | status: success, failure
  registers: [register],
});

export const activeTodos = new Gauge({
  name: 'todos_active_total',
  help: 'Total number of active (not completed) todos',
  registers: [register],
});

export const completedTodos = new Gauge({
  name: 'todos_completed_total',
  help: 'Total number of completed todos',
  registers: [register],
});

// ============================================================================
// Database Metrics
// ============================================================================

export const dbQueryDuration = new Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of database queries',
  labelNames: ['operation', 'model'], // operation: findMany, create, update, delete | model: User, Todo, Session
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2],
  registers: [register],
});

export const dbQueryTotal = new Counter({
  name: 'db_queries_total',
  help: 'Total number of database queries',
  labelNames: ['operation', 'model', 'status'], // status: success, failure
  registers: [register],
});

export const dbConnectionPool = new Gauge({
  name: 'db_connection_pool_size',
  help: 'Current database connection pool size',
  labelNames: ['state'], // state: active, idle
  registers: [register],
});

// ============================================================================
// GraphQL Metrics
// ============================================================================

export const graphqlOperations = new Counter({
  name: 'graphql_operations_total',
  help: 'Total number of GraphQL operations',
  labelNames: ['operation_type', 'operation_name', 'status'], // operation_type: query, mutation, subscription
  registers: [register],
});

export const graphqlResolverDuration = new Histogram({
  name: 'graphql_resolver_duration_seconds',
  help: 'Duration of GraphQL resolver execution',
  labelNames: ['resolver_name', 'parent_type'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
  registers: [register],
});

export const graphqlErrors = new Counter({
  name: 'graphql_errors_total',
  help: 'Total number of GraphQL errors',
  labelNames: ['error_type', 'operation_name'],
  registers: [register],
});

// ============================================================================
// WebSocket Metrics
// ============================================================================

export const websocketConnections = new Gauge({
  name: 'websocket_connections_active',
  help: 'Number of active WebSocket connections',
  registers: [register],
});

export const websocketMessages = new Counter({
  name: 'websocket_messages_total',
  help: 'Total number of WebSocket messages',
  labelNames: ['event_type', 'direction'], // direction: sent, received
  registers: [register],
});

export const websocketErrors = new Counter({
  name: 'websocket_errors_total',
  help: 'Total number of WebSocket errors',
  labelNames: ['error_type'],
  registers: [register],
});

// ============================================================================
// Business Metrics
// ============================================================================

export const usersByRole = new Gauge({
  name: 'users_by_role',
  help: 'Number of users by role',
  labelNames: ['role'], // role: STARTER, PRO
  registers: [register],
});

export const apiCallsByRole = new Counter({
  name: 'api_calls_by_role_total',
  help: 'Total number of API calls by user role',
  labelNames: ['role', 'endpoint_type'], // endpoint_type: rest, graphql
  registers: [register],
});

// ============================================================================
// Rate Limiting Metrics
// ============================================================================

export const rateLimitHits = new Counter({
  name: 'rate_limit_hits_total',
  help: 'Total number of rate limit hits',
  labelNames: ['endpoint', 'limit_type'], // limit_type: global, per_user
  registers: [register],
});

export const rateLimitBlocked = new Counter({
  name: 'rate_limit_blocked_total',
  help: 'Total number of requests blocked by rate limiting',
  labelNames: ['endpoint'],
  registers: [register],
});

// ============================================================================
// Cache Metrics (if caching is implemented)
// ============================================================================

export const cacheHits = new Counter({
  name: 'cache_hits_total',
  help: 'Total number of cache hits',
  labelNames: ['cache_type'],
  registers: [register],
});

export const cacheMisses = new Counter({
  name: 'cache_misses_total',
  help: 'Total number of cache misses',
  labelNames: ['cache_type'],
  registers: [register],
});

// ============================================================================
// Redis Metrics
// ============================================================================

export const redisCommands = new Counter({
  name: 'redis_commands_total',
  help: 'Total number of Redis commands executed',
  labelNames: ['command', 'status'], // status: success, failure
  registers: [register],
});

export const redisCommandDuration = new Histogram({
  name: 'redis_command_duration_seconds',
  help: 'Duration of Redis commands in seconds',
  labelNames: ['command'],
  buckets: [0.0001, 0.0005, 0.001, 0.005, 0.01, 0.05, 0.1],
  registers: [register],
});

export const redisConnections = new Gauge({
  name: 'redis_connections_active',
  help: 'Number of active Redis connections',
  registers: [register],
});

// ============================================================================
// HTTP Request Size Metrics
// ============================================================================

export const httpRequestSize = new Histogram({
  name: 'http_request_size_bytes',
  help: 'Size of HTTP requests in bytes',
  labelNames: ['method', 'route'],
  buckets: [100, 1000, 5000, 10000, 50000, 100000, 500000],
  registers: [register],
});

export const httpResponseSize = new Histogram({
  name: 'http_response_size_bytes',
  help: 'Size of HTTP responses in bytes',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [100, 1000, 5000, 10000, 50000, 100000, 500000],
  registers: [register],
});

// ============================================================================
// System Error Metrics
// ============================================================================

export const systemErrors = new Counter({
  name: 'system_errors_total',
  help: 'Total number of system errors',
  labelNames: ['error_type', 'severity'], // severity: warning, error, critical
  registers: [register],
});

export const uncaughtExceptions = new Counter({
  name: 'uncaught_exceptions_total',
  help: 'Total number of uncaught exceptions',
  registers: [register],
});

export const unhandledRejections = new Counter({
  name: 'unhandled_rejections_total',
  help: 'Total number of unhandled promise rejections',
  registers: [register],
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Record HTTP request metrics
 */
export function recordHttpRequest(
  method: string,
  route: string,
  statusCode: number,
  durationSeconds: number
) {
  httpRequestDuration.labels(method, route, statusCode.toString()).observe(durationSeconds);
  httpRequestTotal.labels(method, route, statusCode.toString()).inc();
}

/**
 * Record authentication operation
 */
export function recordAuthOperation(operation: string, success: boolean) {
  authOperations.labels(operation, success ? 'success' : 'failure').inc();
}

/**
 * Record todo operation
 */
export function recordTodoOperation(operation: string, success: boolean) {
  todoOperations.labels(operation, success ? 'success' : 'failure').inc();
}

/**
 * Record database query
 */
export function recordDbQuery(
  operation: string,
  model: string,
  durationSeconds: number,
  success: boolean
) {
  dbQueryDuration.labels(operation, model).observe(durationSeconds);
  dbQueryTotal.labels(operation, model, success ? 'success' : 'failure').inc();
}

/**
 * Record GraphQL operation
 */
export function recordGraphqlOperation(
  operationType: string,
  operationName: string,
  success: boolean
) {
  graphqlOperations.labels(operationType, operationName, success ? 'success' : 'failure').inc();
}

/**
 * Update active sessions count
 */
export function updateActiveSessionsCount(count: number) {
  activeSessions.set(count);
}

/**
 * Update todo statistics
 */
export function updateTodoStats(active: number, completed: number) {
  activeTodos.set(active);
  completedTodos.set(completed);
}

/**
 * Update users by role statistics
 */
export function updateUsersByRole(role: string, count: number) {
  usersByRole.labels(role).set(count);
}

/**
 * Record Redis command
 */
export function recordRedisCommand(command: string, durationSeconds: number, success: boolean) {
  redisCommandDuration.labels(command).observe(durationSeconds);
  redisCommands.labels(command, success ? 'success' : 'failure').inc();
}

/**
 * Record HTTP request/response size
 */
export function recordHttpSize(
  method: string,
  route: string,
  requestSize: number,
  responseSize: number,
  statusCode: number
) {
  if (requestSize > 0) {
    httpRequestSize.labels(method, route).observe(requestSize);
  }
  if (responseSize > 0) {
    httpResponseSize.labels(method, route, statusCode.toString()).observe(responseSize);
  }
}

/**
 * Record system error
 */
export function recordSystemError(errorType: string, severity: 'warning' | 'error' | 'critical') {
  systemErrors.labels(errorType, severity).inc();
}

/**
 * Track WebSocket connection change
 */
export function updateWebsocketConnections(change: 1 | -1) {
  if (change === 1) {
    websocketConnections.inc();
  } else {
    websocketConnections.dec();
  }
}

/**
 * Record WebSocket message
 */
export function recordWebsocketMessage(eventType: string, direction: 'sent' | 'received') {
  websocketMessages.labels(eventType, direction).inc();
}
