import { z } from 'zod';

// ============================================
// Base Todo Schema
// ============================================
export const TodoSchema = z.object({
  id: z.string(),
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  completed: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// ============================================
// API Input Schemas (Request validation)
// ============================================
export const CreateTodoInputSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  completed: z.boolean().optional().default(false),
});

export const UpdateTodoInputSchema = z
  .object({
    title: z.string().min(1, 'Title is required').max(200, 'Title too long').optional(),
    completed: z.boolean().optional(),
  })
  .strict() // No extra fields allowed
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  });

export const TodoFilterSchema = z.object({
  completed: z.boolean().optional(),
  titleContains: z.string().optional(),
});

export const TodoQueryParamsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.enum(['createdAt', 'updatedAt', 'title', 'completed']).default('createdAt'),
  sortOrder: z.enum(['ASC', 'DESC']).default('DESC'),
  // Filter params (flattened for query string)
  completed: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((val) => {
      if (typeof val === 'string') {
        return val === 'true';
      }
      return val;
    }),
  titleContains: z.string().optional(),
});

// ============================================
// Response Schemas
// ============================================
export const PaginationMetaSchema = z.object({
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  totalPages: z.number().int().nonnegative(),
});

export const TodosResponseSchema = z.object({
  data: z.array(TodoSchema),
  meta: PaginationMetaSchema,
});

export const ApiErrorSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
  details: z.array(z.any()).optional(),
});

// ============================================
// Derived TypeScript Types (for static typing)
// ============================================
export type Todo = z.infer<typeof TodoSchema>;

// Input type allows optional completed field
export type CreateTodoInput = z.input<typeof CreateTodoInputSchema>;

// Output type has completed field with default
export type CreateTodoOutput = z.output<typeof CreateTodoInputSchema>;

export type UpdateTodoInput = z.infer<typeof UpdateTodoInputSchema>;
export type TodoFilter = z.infer<typeof TodoFilterSchema>;
export type TodoQueryParams = z.infer<typeof TodoQueryParamsSchema>;
export type PaginationMeta = z.infer<typeof PaginationMetaSchema>;
export type TodosResponse = z.infer<typeof TodosResponseSchema>;
export type ApiError = z.infer<typeof ApiErrorSchema>;

// ============================================
// Validation Helpers
// ============================================

/**
 * Validate and parse create todo input
 * @throws ZodError if validation fails
 */
export const validateCreateTodo = (data: unknown): CreateTodoInput => {
  return CreateTodoInputSchema.parse(data);
};

/**
 * Validate and parse update todo input
 * @throws ZodError if validation fails
 */
export const validateUpdateTodo = (data: unknown): UpdateTodoInput => {
  return UpdateTodoInputSchema.parse(data);
};

/**
 * Validate and parse query parameters
 * @throws ZodError if validation fails
 */
export const validateQueryParams = (params: unknown): TodoQueryParams => {
  return TodoQueryParamsSchema.parse(params);
};

/**
 * Safe validation that returns result object instead of throwing
 */
export const safeValidateCreateTodo = (data: unknown) => {
  return CreateTodoInputSchema.safeParse(data);
};

export const safeValidateUpdateTodo = (data: unknown) => {
  return UpdateTodoInputSchema.safeParse(data);
};

export const safeValidateQueryParams = (params: unknown) => {
  return TodoQueryParamsSchema.safeParse(params);
};
