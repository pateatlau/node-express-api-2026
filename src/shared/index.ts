/**
 * Shared types and schemas for use across frontend and backend
 *
 * This module exports:
 * - Zod schemas for runtime validation
 * - TypeScript types inferred from schemas
 * - Validation helper functions
 */

// Export all schemas, types, and validators
export * from './schemas/todo.schema.js';

// Re-export commonly used items for convenience
export type {
  Todo,
  CreateTodoInput,
  UpdateTodoInput,
  TodoQueryParams,
  TodosResponse,
  PaginationMeta,
  ApiError,
} from './schemas/todo.schema.js';

export {
  TodoSchema,
  CreateTodoInputSchema,
  UpdateTodoInputSchema,
  TodoQueryParamsSchema,
  validateCreateTodo,
  validateUpdateTodo,
  validateQueryParams,
  safeValidateCreateTodo,
  safeValidateUpdateTodo,
  safeValidateQueryParams,
} from './schemas/todo.schema.js';
