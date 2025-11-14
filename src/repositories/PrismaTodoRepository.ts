import { prisma } from '../lib/prisma';
import {
  ITodoRepository,
  TodoDTO,
  CreateTodoDTO,
  UpdateTodoDTO,
  PaginationParams,
} from './TodoRepository.interface';

/**
 * Prisma implementation of Todo Repository
 */
export class PrismaTodoRepository implements ITodoRepository {
  async findAll(params: PaginationParams): Promise<TodoDTO[]> {
    if (!params.userId) {
      // Never return all todos; only user-specific
      return [];
    }
    const todos = await prisma.todo.findMany({
      where: { userId: params.userId },
      skip: params.skip,
      take: params.take,
      orderBy: {
        createdAt: 'desc',
      },
    });
    return todos.map((todo) => ({
      id: todo.id,
      title: todo.title,
      completed: todo.completed,
      userId: todo.userId || undefined,
      createdAt: todo.createdAt,
      updatedAt: todo.updatedAt,
    }));
  }

  async findById(id: string, userId?: string): Promise<TodoDTO | null> {
    const where: { id: string; userId?: string } = { id };
    if (userId) {
      where.userId = userId;
    }

    const todo = await prisma.todo.findFirst({
      where,
    });

    if (!todo) {
      return null;
    }

    return {
      id: todo.id,
      title: todo.title,
      completed: todo.completed,
      userId: todo.userId || undefined,
      createdAt: todo.createdAt,
      updatedAt: todo.updatedAt,
    };
  }

  async create(data: CreateTodoDTO): Promise<TodoDTO> {
    const todo = await prisma.todo.create({
      data: {
        title: data.title,
        completed: data.completed ?? false,
        userId: data.userId || null,
      },
    });

    return {
      id: todo.id,
      title: todo.title,
      completed: todo.completed,
      userId: todo.userId || undefined,
      createdAt: todo.createdAt,
      updatedAt: todo.updatedAt,
    };
  }

  async update(id: string, data: UpdateTodoDTO, userId?: string): Promise<TodoDTO | null> {
    try {
      const where: { id: string; userId?: string } = { id };
      if (userId) {
        where.userId = userId;
      }

      const todo = await prisma.todo.updateMany({
        where,
        data: {
          ...(data.title !== undefined && { title: data.title }),
          ...(data.completed !== undefined && { completed: data.completed }),
        },
      });

      if (todo.count === 0) {
        return null;
      }

      // Fetch the updated todo
      const updatedTodo = await prisma.todo.findUnique({
        where: { id },
      });

      if (!updatedTodo) {
        return null;
      }

      return {
        id: updatedTodo.id,
        title: updatedTodo.title,
        completed: updatedTodo.completed,
        userId: updatedTodo.userId || undefined,
        createdAt: updatedTodo.createdAt,
        updatedAt: updatedTodo.updatedAt,
      };
    } catch (_error) {
      void _error;
      return null;
    }
  }

  async delete(id: string, userId?: string): Promise<boolean> {
    try {
      const where: { id: string; userId?: string } = { id };
      if (userId) {
        where.userId = userId;
      }

      const result = await prisma.todo.deleteMany({
        where,
      });

      return result.count > 0;
    } catch (_error) {
      void _error;
      return false;
    }
  }

  async count(userId?: string): Promise<number> {
    const where = userId ? { userId } : {};
    return await prisma.todo.count({ where });
  }
}
