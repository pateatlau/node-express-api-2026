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
    const todos = await prisma.todo.findMany({
      skip: params.skip,
      take: params.take,
      orderBy: {
        createdAt: 'desc',
      },
    });

    // IDs are already strings (UUID)
    return todos.map((todo) => ({
      id: todo.id,
      title: todo.title,
      completed: todo.completed,
      createdAt: todo.createdAt,
      updatedAt: todo.updatedAt,
    }));
  }

  async findById(id: string): Promise<TodoDTO | null> {
    const todo = await prisma.todo.findUnique({
      where: { id },
    });

    if (!todo) {
      return null;
    }

    return {
      id: todo.id,
      title: todo.title,
      completed: todo.completed,
      createdAt: todo.createdAt,
      updatedAt: todo.updatedAt,
    };
  }

  async create(data: CreateTodoDTO): Promise<TodoDTO> {
    const todo = await prisma.todo.create({
      data: {
        title: data.title,
        completed: data.completed ?? false,
      },
    });

    return {
      id: todo.id,
      title: todo.title,
      completed: todo.completed,
      createdAt: todo.createdAt,
      updatedAt: todo.updatedAt,
    };
  }

  async update(id: string, data: UpdateTodoDTO): Promise<TodoDTO | null> {
    try {
      const todo = await prisma.todo.update({
        where: { id },
        data: {
          ...(data.title !== undefined && { title: data.title }),
          ...(data.completed !== undefined && { completed: data.completed }),
        },
      });

      return {
        id: todo.id,
        title: todo.title,
        completed: todo.completed,
        createdAt: todo.createdAt,
        updatedAt: todo.updatedAt,
      };
    } catch (_error) {
      // Prisma throws if record not found
      void _error;
      return null;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await prisma.todo.delete({
        where: { id },
      });
      return true;
    } catch (_error) {
      // Prisma throws if record not found
      void _error;
      return false;
    }
  }

  async count(): Promise<number> {
    return await prisma.todo.count();
  }
}
