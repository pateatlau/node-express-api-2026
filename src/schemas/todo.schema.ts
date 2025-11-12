import { z } from 'zod';

// Schema for creating a todo
export const createTodoSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title is too long'),
  completed: z.boolean().optional().default(false),
});

// Schema for updating a todo
export const updateTodoSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  completed: z.boolean().optional(),
});

// Schema for query parameters (pagination)
export const paginationSchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 20)),
});

// Schema for route params (id)
// Accepts both numeric IDs (PostgreSQL) and MongoDB ObjectIds
export const idParamSchema = z.object({
  id: z.string().min(1, 'ID is required'),
});

// Type exports
export type CreateTodoInput = z.infer<typeof createTodoSchema>;
export type UpdateTodoInput = z.infer<typeof updateTodoSchema>;
export type PaginationQuery = z.infer<typeof paginationSchema>;
export type IdParam = z.infer<typeof idParamSchema>;
