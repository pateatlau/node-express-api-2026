import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

/**
 * Todo validation schemas
 */
export const createTodoSchema = z.object({
  body: z.object({
    title: z
      .string()
      .min(1, 'Title cannot be empty')
      .max(255, 'Title must be less than 255 characters')
      .trim(),
    completed: z.boolean().optional().default(false),
  }),
});

export const updateTodoSchema = z.object({
  body: z
    .object({
      title: z
        .string()
        .min(1, 'Title cannot be empty')
        .max(255, 'Title must be less than 255 characters')
        .trim()
        .optional(),
      completed: z.boolean().optional(),
    })
    .refine((data) => data.title !== undefined || data.completed !== undefined, {
      message: 'At least one field (title or completed) must be provided',
    }),
  params: z.object({
    id: z.string(),
  }),
});

export const getTodoSchema = z.object({
  params: z.object({
    id: z.string(),
  }),
});

export const deleteTodoSchema = z.object({
  params: z.object({
    id: z.string(),
  }),
});

export const listTodosSchema = z.object({
  query: z.object({
    page: z
      .string()
      .optional()
      .default('1')
      .transform((val) => parseInt(val, 10))
      .refine((val) => val > 0, 'Page must be greater than 0'),
    limit: z
      .string()
      .optional()
      .default('10')
      .transform((val) => parseInt(val, 10))
      .refine((val) => val > 0 && val <= 100, 'Limit must be between 1 and 100'),
    completed: z
      .string()
      .optional()
      .transform((val) => val === 'true')
      .optional(),
  }),
});

/**
 * Pagination schema (reusable)
 */
export const paginationSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(10),
  skip: z.number().int().nonnegative().optional(),
});

/**
 * Generic validation middleware factory
 * Validates request against a Zod schema
 */
export const validate = (schema: z.ZodObject<z.ZodRawShape>) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Validate and parse request
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        // Format Zod errors
        const errors = error.issues.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        }));

        res.status(400).json({
          error: 'Validation failed',
          details: errors,
        });
        return;
      }

      // Unexpected error
      next(error);
    }
  };
};

/**
 * Email validation schema
 */
export const emailSchema = z.string().email('Invalid email address').toLowerCase().trim();

/**
 * Password validation schema
 */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be less than 128 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

/**
 * User registration schema (example)
 */
export const registerUserSchema = z.object({
  body: z
    .object({
      email: emailSchema,
      password: passwordSchema,
      name: z
        .string()
        .min(2, 'Name must be at least 2 characters')
        .max(100, 'Name must be less than 100 characters')
        .trim(),
      confirmPassword: z.string(),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: 'Passwords do not match',
      path: ['confirmPassword'],
    }),
});

/**
 * User login schema (example)
 */
export const loginUserSchema = z.object({
  body: z.object({
    email: emailSchema,
    password: z.string().min(1, 'Password is required'),
  }),
});

/**
 * Types inferred from schemas
 */
export type CreateTodoInput = z.infer<typeof createTodoSchema>['body'];
export type UpdateTodoInput = z.infer<typeof updateTodoSchema>['body'];
export type ListTodosQuery = z.infer<typeof listTodosSchema>['query'];
export type PaginationParams = z.infer<typeof paginationSchema>;
