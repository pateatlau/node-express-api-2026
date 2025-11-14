import { Router, Request, Response } from 'express';
import { RepositoryFactory } from '../repositories/RepositoryFactory';
import { validateBody, validateParams, validateQuery } from '../middleware/validate';
import {
  CreateTodoInputSchema,
  UpdateTodoInputSchema,
  TodoQueryParamsSchema,
} from '../shared/index.js';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireAnyRole } from '../middleware/rbac.middleware.js';
import type { AuthRequest } from '../types/auth.types.js';

// ID param schema for route validation
const idParamSchema = z.object({
  id: z.string().min(1, 'ID is required'),
});

const router = Router();

// Get the todo repository instance
const todoRepository = RepositoryFactory.getTodoRepository();

// Apply authentication and RBAC to all todo routes
// Both STARTER and PRO users can access REST API
router.use(authenticate, requireAnyRole);

/**
 * @swagger
 * /api/todos:
 *   get:
 *     summary: Get all todos with pagination
 *     tags: [Todos]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: List of todos with pagination metadata
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedTodos'
 */
// Get all todos with optional pagination
router.get('/', validateQuery(TodoQueryParamsSchema), async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const userId = authReq.user?.userId;
  console.log('[Todos GET] userId:', userId);

  const { page = 1, limit = 10 } = req.query as {
    page?: number;
    limit?: number;
  };
  const skip = (page - 1) * limit;

  const [todos, total] = await Promise.all([
    todoRepository.findAll({ skip, take: limit, userId }),
    todoRepository.count(userId),
  ]);

  res.json({
    data: todos,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
});

/**
 * @swagger
 * /api/todos/{id}:
 *   get:
 *     summary: Get a todo by ID
 *     tags: [Todos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Todo ID
 *     responses:
 *       200:
 *         description: Todo found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Todo'
 *       404:
 *         description: Todo not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Get a single todo by id
router.get('/:id', validateParams(idParamSchema), async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const userId = authReq.user?.userId;
  const { id } = req.params;
  console.log('[Todos GET by ID] userId:', userId, 'id:', id);

  const todo = await todoRepository.findById(id, userId);

  if (!todo) {
    return res.status(404).json({ error: 'Todo not found' });
  }

  res.json(todo);
});

/**
 * @swagger
 * /api/todos:
 *   post:
 *     summary: Create a new todo
 *     tags: [Todos]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateTodoInput'
 *     responses:
 *       201:
 *         description: Todo created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Todo'
 *       400:
 *         description: Invalid input
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Create a new todo
router.post('/', validateBody(CreateTodoInputSchema), async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const userId = authReq.user?.userId;
  console.log('[Todos POST] userId:', userId);

  const { title, completed = false } = req.body;

  const todo = await todoRepository.create({
    title,
    completed,
    userId,
  });

  res.status(201).json(todo);
});

/**
 * @swagger
 * /api/todos/{id}:
 *   put:
 *     summary: Update a todo
 *     tags: [Todos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Todo ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateTodoInput'
 *     responses:
 *       200:
 *         description: Todo updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Todo'
 *       404:
 *         description: Todo not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Update a todo
router.put(
  '/:id',
  validateParams(idParamSchema),
  validateBody(UpdateTodoInputSchema),
  async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.userId;
    const { id } = req.params;
    console.log('[Todos PUT] userId:', userId, 'id:', id);

    const { title, completed } = req.body;

    const todo = await todoRepository.update(
      id,
      {
        ...(title !== undefined && { title }),
        ...(completed !== undefined && { completed }),
      },
      userId
    );

    if (!todo) {
      return res.status(404).json({ error: 'Todo not found' });
    }

    res.json(todo);
  }
);

/**
 * @swagger
 * /api/todos/{id}:
 *   delete:
 *     summary: Delete a todo
 *     tags: [Todos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Todo ID
 *     responses:
 *       204:
 *         description: Todo deleted successfully
 *       404:
 *         description: Todo not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Delete a todo
router.delete('/:id', validateParams(idParamSchema), async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const userId = authReq.user?.userId;
  const { id } = req.params;
  console.log('[Todos DELETE] userId:', userId, 'id:', id);

  const deleted = await todoRepository.delete(id, userId);

  if (!deleted) {
    return res.status(404).json({ error: 'Todo not found' });
  }

  res.status(204).end();
});

export default router;
