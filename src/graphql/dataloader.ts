import DataLoader from 'dataloader';
import type { ITodoRepository, TodoDTO } from '../repositories/TodoRepository.interface.js';
import logger from '../config/logger.js';

/**
 * DataLoader for batching and caching todo queries
 * Prevents N+1 query problems and improves performance
 */
export class TodoDataLoader {
  private loader: DataLoader<string, TodoDTO | null>;

  // eslint-disable-next-line no-unused-vars
  constructor(private readonly todoRepository: ITodoRepository) {
    this.loader = new DataLoader<string, TodoDTO | null>(
      async (ids: readonly string[]) => {
        return this.batchLoadTodos(ids as string[]);
      },
      {
        // Cache results for the duration of a single request
        cache: true,
        // Batch multiple loads that occur within 10ms
        batchScheduleFn: (callback) => setTimeout(callback, 10),
      }
    );
  }

  /**
   * Batch load multiple todos by ID
   */
  private async batchLoadTodos(ids: readonly string[]): Promise<(TodoDTO | null)[]> {
    logger.debug('DataLoader batch loading todos', {
      count: ids.length,
      ids: ids.slice(0, 10), // Log first 10 IDs only
    });

    // Fetch all todos in a single query (no pagination for batch loading)
    const allTodos = await this.todoRepository.findAll({
      skip: 0,
      take: 1000, // Large limit for batch loading
    });

    // Create a map for O(1) lookups
    const todoMap = new Map<string, TodoDTO>();
    allTodos.forEach((todo) => {
      todoMap.set(todo.id, todo);
    });

    // Return todos in the same order as requested IDs
    // Return null for IDs that don't exist
    return ids.map((id) => todoMap.get(id) || null);
  }

  /**
   * Load a single todo by ID (will be batched with other loads)
   */
  async load(id: string): Promise<TodoDTO | null> {
    return this.loader.load(id);
  }

  /**
   * Load multiple todos by IDs (will be batched)
   */
  async loadMany(ids: string[]): Promise<(TodoDTO | null)[]> {
    const results = await this.loader.loadMany(ids);
    // Convert Error to null for consistency
    return results.map((result) => (result instanceof Error ? null : result));
  }

  /**
   * Prime the cache with a todo (useful after mutations)
   */
  prime(id: string, todo: TodoDTO): void {
    this.loader.prime(id, todo);
  }

  /**
   * Clear a specific todo from cache
   */
  clear(id: string): void {
    this.loader.clear(id);
  }

  /**
   * Clear all cached todos
   */
  clearAll(): void {
    this.loader.clearAll();
  }
}

/**
 * Factory function to create a new DataLoader instance per request
 */
export function createTodoDataLoader(todoRepository: ITodoRepository): TodoDataLoader {
  return new TodoDataLoader(todoRepository);
}
