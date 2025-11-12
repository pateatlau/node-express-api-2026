import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTodoDataLoader } from '../dataloader';
import { ITodoRepository } from '../../repositories/TodoRepository.interface';

// Mock repository
const mockRepository: ITodoRepository = {
  findAll: vi.fn(),
  count: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

describe('DataLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createTodoDataLoader', () => {
    it('should batch multiple findById calls into single repository call', async () => {
      const mockTodos = [
        {
          id: '1',
          title: 'Todo 1',
          completed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '2',
          title: 'Todo 2',
          completed: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '3',
          title: 'Todo 3',
          completed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      // DataLoader batches by calling findAll once
      vi.mocked(mockRepository.findAll).mockResolvedValue(mockTodos);

      const loader = createTodoDataLoader(mockRepository);

      // Load multiple todos
      const promises = [loader.load('1'), loader.load('2'), loader.load('3')];

      const results = await Promise.all(promises);

      // Should batch into single findAll call
      expect(mockRepository.findAll).toHaveBeenCalledTimes(1);
      expect(mockRepository.findAll).toHaveBeenCalledWith({
        skip: 0,
        take: 1000,
      });
      expect(results).toHaveLength(3);
      expect(results[0]?.id).toBe('1');
      expect(results[1]?.id).toBe('2');
      expect(results[2]?.id).toBe('3');
    });

    it('should cache results for duplicate IDs in same batch', async () => {
      const mockTodo = {
        id: '1',
        title: 'Todo 1',
        completed: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(mockRepository.findAll).mockResolvedValue([mockTodo]);

      const loader = createTodoDataLoader(mockRepository);

      // Load same ID multiple times
      const promises = [loader.load('1'), loader.load('1'), loader.load('1')];

      const results = await Promise.all(promises);

      // Should only call findAll once due to batching/caching
      expect(mockRepository.findAll).toHaveBeenCalledTimes(1);
      expect(results).toHaveLength(3);
      expect(results[0]?.id).toBe('1');
      expect(results[1]?.id).toBe('1');
      expect(results[2]?.id).toBe('1');
    });

    it('should handle null results for non-existent todos', async () => {
      // Return empty array - the todo won't be found
      vi.mocked(mockRepository.findAll).mockResolvedValue([]);

      const loader = createTodoDataLoader(mockRepository);

      const result = await loader.load('nonexistent');

      expect(result).toBeNull();
      expect(mockRepository.findAll).toHaveBeenCalledWith({
        skip: 0,
        take: 1000,
      });
    });

    it('should clear cache and reload on second batch', async () => {
      const mockTodo = {
        id: '1',
        title: 'Todo 1',
        completed: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(mockRepository.findAll).mockResolvedValue([mockTodo]);

      const loader = createTodoDataLoader(mockRepository);

      // First batch
      await loader.load('1');
      expect(mockRepository.findAll).toHaveBeenCalledTimes(1);

      // Clear cache
      loader.clear('1');

      // Second batch - should call repository again
      await loader.load('1');
      expect(mockRepository.findAll).toHaveBeenCalledTimes(2);
    });
  });
});
