/**
 * Shared types for microservices
 */

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'USER' | 'PRO' | 'ADMIN';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Session {
  id: string;
  userId: string;
  sessionToken: string;
  deviceInfo?: Record<string, unknown>;
  ipAddress?: string;
  lastActivity: Date;
  createdAt: Date;
  expiresAt: Date;
}

export interface AuthRequest {
  user?: {
    userId: string;
    email: string;
    role: string;
  };
}

export interface ServiceResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Event types for Redis pub/sub
export interface ServiceEvent {
  type: string;
  data: unknown;
  timestamp: number;
  service: string;
}

export interface AuthEvent extends ServiceEvent {
  type: 'user.login' | 'user.logout' | 'session.created' | 'session.terminated';
  data: {
    userId: string;
    sessionId?: string;
    email?: string;
  };
}
