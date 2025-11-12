import DataLoader from 'dataloader';
import { TodoDTO } from '../repositories/TodoRepository.interface';
import { ITodoRepository } from '../repositories/TodoRepository.interface';

/**
 * Create DataLoaders for batch loading todos
 * This prevents N+1 query problems in GraphQL resolvers
 */
export interface DataLoaders {
  todoLoader: DataLoader<string, TodoDTO | null>;
  todosLoader: DataLoader<string, TodoDTO[]>;
}

/**
 * Create a new set of DataLoaders for a request
 * Each request should get its own DataLoaders to prevent caching across requests
 */
export const createDataLoaders = (todoRepository: ITodoRepository): DataLoaders => {
  // Batch load individual todos by ID
  const todoLoader = new DataLoader<string, TodoDTO | null>(
    async (ids: readonly string[]) => {
      // Fetch all requested todos in a single query
      const todos = await Promise.all(ids.map((id) => todoRepository.findById(id)));

      // Return results in the same order as requested
      return todos;
    },
    {
      // Cache results for the duration of the request
      cache: true,
      // Batch requests that occur within 10ms
      batchScheduleFn: (callback) => setTimeout(callback, 10),
      // Maximum batch size
      maxBatchSize: 100,
    }
  );

  // Batch load todos by user or filter criteria
  // This is a placeholder - adjust based on your actual use case
  const todosLoader = new DataLoader<string, TodoDTO[]>(
    async (keys: readonly string[]) => {
      // For now, return empty arrays
      // In a real app, you'd batch load todos by user ID or filter
      return keys.map(() => []);
    },
    {
      cache: true,
      batchScheduleFn: (callback) => setTimeout(callback, 10),
      maxBatchSize: 100,
    }
  );

  return {
    todoLoader,
    todosLoader,
  };
};

/**
 * Example: Clear all DataLoader caches
 * Useful for testing or when data changes outside the GraphQL context
 */
export const clearDataLoaders = (loaders: DataLoaders): void => {
  loaders.todoLoader.clearAll();
  loaders.todosLoader.clearAll();
};

/**
 * Example: Prime a DataLoader cache
 * Useful when you already have data and want to prevent refetching
 */
export const primeTodoLoader = (loaders: DataLoaders, todo: TodoDTO): void => {
  loaders.todoLoader.prime(todo.id, todo);
};
