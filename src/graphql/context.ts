import type { Request, Response } from 'express';
import type { ITodoRepository } from '../repositories/TodoRepository.interface.js';
import { RepositoryFactory } from '../repositories/RepositoryFactory.js';
import { createTodoDataLoader, type TodoDataLoader } from './dataloader.js';
import { pubsub } from './pubsub.js';
import type { PubSub } from 'graphql-subscriptions';
import type { AuthRequest } from '../types/auth.types.js';
import { Role } from '@prisma/client';

/**
 * User information from JWT token
 */
export interface ContextUser {
  userId: string;
  email: string;
  role: Role;
}

/**
 * GraphQL Context Interface
 * Contains all dependencies needed by resolvers
 */
export interface GraphQLContext {
  /** Express request object */
  req?: Request;
  /** Express response object */
  res?: Response;
  /** Authenticated user (if present) */
  user?: ContextUser;
  /** Todo repository (database abstraction) */
  todoRepository: ITodoRepository;
  /** DataLoader for batching and caching */
  todoLoader: TodoDataLoader;
  /** PubSub for subscriptions */
  pubsub: PubSub;
}

/**
 * Create GraphQL context for each request
 * This is called once per GraphQL operation
 */
export async function createGraphQLContext({
  req,
  res,
}: {
  req?: Request;
  res?: Response;
}): Promise<GraphQLContext> {
  // Get the appropriate repository based on DB_TYPE
  const todoRepository = RepositoryFactory.getTodoRepository();

  // Create a fresh DataLoader instance per request
  // This ensures caching is scoped to a single request
  const todoLoader = createTodoDataLoader(todoRepository);

  // Extract user from request if authenticated (from auth middleware)
  const authReq = req as AuthRequest;
  const user = authReq?.user;

  return {
    req,
    res,
    user,
    todoRepository,
    todoLoader,
    pubsub,
  };
}

/**
 * Context for WebSocket connections (subscriptions)
 * Simpler context since there's no HTTP request/response
 */
export async function createSubscriptionContext(): Promise<Omit<GraphQLContext, 'req' | 'res'>> {
  const todoRepository = RepositoryFactory.getTodoRepository();
  const todoLoader = createTodoDataLoader(todoRepository);

  return {
    todoRepository,
    todoLoader,
    pubsub,
  };
}
