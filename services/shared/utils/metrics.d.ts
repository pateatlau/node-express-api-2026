import { Request, Response, NextFunction } from 'express';
import promClient from 'prom-client';
/**
 * Shared metrics utilities for microservices
 * Provides Prometheus metrics collection
 */
export declare const register: promClient.Registry<"text/plain; version=0.0.4; charset=utf-8">;
/**
 * Initialize metrics for a service
 * Call this once at service startup
 */
export declare function initializeMetrics(serviceName: string): void;
export declare const httpRequestDuration: promClient.Histogram<"service" | "method" | "route" | "status_code">;
export declare const httpRequestTotal: promClient.Counter<"service" | "method" | "route" | "status_code">;
export declare const activeConnections: promClient.Gauge<"service">;
export declare const databaseQueryDuration: promClient.Histogram<"service" | "operation" | "table">;
/**
 * Middleware to collect HTTP metrics
 */
export declare function metricsMiddleware(serviceName: string): (req: Request, res: Response, next: NextFunction) => void;
/**
 * Metrics endpoint handler
 */
export declare function metricsHandler(_req: Request, res: Response): Promise<void>;
//# sourceMappingURL=metrics.d.ts.map