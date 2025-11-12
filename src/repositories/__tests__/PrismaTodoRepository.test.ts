import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PrismaTodoRepository } from '../PrismaTodoRepository';
import { prisma } from '../../lib/prisma';

// Mock Prisma client
vi.mock('../../lib/prisma', () => ({
  prisma: {
    todo: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

describe('PrismaTodoRepository', () => {
  let repository: PrismaTodoRepository;

  beforeEach(() => {
    repository = new PrismaTodoRepository();
    vi.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return paginated todos', async () => {
      const mockTodos = [
        {
          id: '1',
          title: 'Test Todo 1',
          completed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '2',
          title: 'Test Todo 2',
          completed: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(prisma.todo.findMany).mockResolvedValue(mockTodos);

      const result = await repository.findAll({ skip: 0, take: 10 });

      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('Test Todo 1');
      expect(prisma.todo.findMany).toHaveBeenCalledWith({
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should apply pagination parameters', async () => {
      vi.mocked(prisma.todo.findMany).mockResolvedValue([]);

      await repository.findAll({ skip: 20, take: 5 });

      expect(prisma.todo.findMany).toHaveBeenCalledWith({
        skip: 20,
        take: 5,
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('findById', () => {
    it('should return a todo when found', async () => {
      const mockTodo = {
        id: '123',
        title: 'Test Todo',
        completed: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.todo.findUnique).mockResolvedValue(mockTodo);

      const result = await repository.findById('123');

      expect(result).toBeDefined();
      expect(result?.id).toBe('123');
      expect(result?.title).toBe('Test Todo');
      expect(prisma.todo.findUnique).toHaveBeenCalledWith({
        where: { id: '123' },
      });
    });

    it('should return null when todo not found', async () => {
      vi.mocked(prisma.todo.findUnique).mockResolvedValue(null);

      const result = await repository.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should create a new todo', async () => {
      const now = new Date();
      const mockCreated = {
        id: '456',
        title: 'New Todo',
        completed: false,
        createdAt: now,
        updatedAt: now,
      };

      vi.mocked(prisma.todo.create).mockResolvedValue(mockCreated);

      const result = await repository.create({
        title: 'New Todo',
        completed: false,
      });

      expect(result).toBeDefined();
      expect(result.id).toBe('456');
      expect(result.title).toBe('New Todo');
      expect(result.completed).toBe(false);
      expect(prisma.todo.create).toHaveBeenCalledWith({
        data: {
          title: 'New Todo',
          completed: false,
        },
      });
    });
  });

  describe('update', () => {
    it('should update an existing todo', async () => {
      const now = new Date();
      const mockUpdated = {
        id: '789',
        title: 'Updated Todo',
        completed: true,
        createdAt: now,
        updatedAt: now,
      };

      vi.mocked(prisma.todo.update).mockResolvedValue(mockUpdated);

      const result = await repository.update('789', {
        title: 'Updated Todo',
        completed: true,
      });

      expect(result).toBeDefined();
      expect(result?.title).toBe('Updated Todo');
      expect(result?.completed).toBe(true);
      expect(prisma.todo.update).toHaveBeenCalledWith({
        where: { id: '789' },
        data: {
          title: 'Updated Todo',
          completed: true,
        },
      });
    });

    it('should return null when updating nonexistent todo', async () => {
      vi.mocked(prisma.todo.update).mockRejectedValue(new Error('Not found'));

      const result = await repository.update('nonexistent', {
        title: 'Updated',
      });

      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete a todo and return true', async () => {
      const mockDeleted = {
        id: '999',
        title: 'To Delete',
        completed: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.todo.delete).mockResolvedValue(mockDeleted);

      const result = await repository.delete('999');

      expect(result).toBe(true);
      expect(prisma.todo.delete).toHaveBeenCalledWith({
        where: { id: '999' },
      });
    });

    it('should return false when deleting nonexistent todo', async () => {
      vi.mocked(prisma.todo.delete).mockRejectedValue(new Error('Not found'));

      const result = await repository.delete('nonexistent');

      expect(result).toBe(false);
    });
  });
});
