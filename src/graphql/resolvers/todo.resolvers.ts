import type { GraphQLContext } from '../context.js';
import {
  publishTodoCreated,
  publishTodoUpdated,
  publishTodoDeleted,
  TODO_EVENTS,
} from '../pubsub.js';
import type {
  CreateTodoDTO,
  UpdateTodoDTO,
} from '../../repositories/TodoRepository.interface.js';

/**
 * GraphQL Input Types (matching schema)
 */
interface CreateTodoInput {
  title: string;
  completed?: boolean;
}

interface UpdateTodoInput {
  title?: string;
  completed?: boolean;
}

interface TodoFilterInput {
  completed?: boolean;
  titleContains?: string;
}

interface TodosArgs {
  page?: number;
  limit?: number;
  filter?: TodoFilterInput;
  sortBy?: 'createdAt' | 'updatedAt' | 'title' | 'completed';
  sortOrder?: 'ASC' | 'DESC';
}

/**
 * Query Resolvers
 */
const Query = {
  /**
   * Get paginated list of todos with optional filtering and sorting
   */
  async todos(
    _parent: unknown,
    args: TodosArgs,
    context: GraphQLContext
  ): Promise<{
    data: unknown[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const page = args.page || 1;
    const limit = Math.min(args.limit || 20, 100); // Max 100 items per page
    const skip = (page - 1) * limit;

    // Fetch all todos first (for filtering)
    let allTodos = await context.todoRepository.findAll({
      skip: 0,
      take: 1000,
    });

    // Apply filters if provided
    if (args.filter) {
      if (args.filter.completed !== undefined) {
        allTodos = allTodos.filter(
          (todo) => todo.completed === args.filter!.completed
        );
      }
      if (args.filter.titleContains) {
        const searchTerm = args.filter.titleContains.toLowerCase();
        allTodos = allTodos.filter((todo) =>
          todo.title.toLowerCase().includes(searchTerm)
        );
      }
    }

    // Apply sorting
    const sortBy = args.sortBy || 'createdAt';
    const sortOrder = args.sortOrder || 'DESC';
    allTodos.sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];

      // Handle date strings
      if (sortBy === 'createdAt' || sortBy === 'updatedAt') {
        const aTime = new Date(aVal as Date).getTime();
        const bTime = new Date(bVal as Date).getTime();
        return sortOrder === 'ASC' ? aTime - bTime : bTime - aTime;
      }

      // Handle other fields
      if (sortOrder === 'ASC') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    // Calculate pagination
    const total = allTodos.length;
    const totalPages = Math.ceil(total / limit);
    const paginatedTodos = allTodos.slice(skip, skip + limit);

    return {
      data: paginatedTodos,
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  },

  /**
   * Get a single todo by ID (uses DataLoader for caching)
   */
  async todo(
    _parent: unknown,
    args: { id: string },
    context: GraphQLContext
  ): Promise<unknown> {
    // Use DataLoader for automatic batching and caching
    return context.todoLoader.load(args.id);
  },

  /**
   * Health check
   */
  health(): {
    status: string;
    database: string;
    dbType: string;
  } {
    const dbType = process.env.DB_TYPE || 'postgres';
    return {
      status: 'ok',
      database: 'connected',
      dbType,
    };
  },
};

/**
 * Mutation Resolvers
 */
const Mutation = {
  /**
   * Create a new todo
   */
  async createTodo(
    _parent: unknown,
    args: { input: CreateTodoInput },
    context: GraphQLContext
  ): Promise<unknown> {
    const todoData: CreateTodoDTO = {
      title: args.input.title,
      completed: args.input.completed ?? false,
    };

    const newTodo = await context.todoRepository.create(todoData);

    // Prime the DataLoader cache
    context.todoLoader.prime(newTodo.id, newTodo);

    // Publish subscription event
    publishTodoCreated(newTodo);

    return newTodo;
  },

  /**
   * Update an existing todo
   */
  async updateTodo(
    _parent: unknown,
    args: { id: string; input: UpdateTodoInput },
    context: GraphQLContext
  ): Promise<unknown> {
    const updateData: UpdateTodoDTO = {};
    if (args.input.title !== undefined) updateData.title = args.input.title;
    if (args.input.completed !== undefined)
      updateData.completed = args.input.completed;

    const updatedTodo = await context.todoRepository.update(
      args.id,
      updateData
    );

    if (updatedTodo) {
      // Clear DataLoader cache for this todo
      context.todoLoader.clear(args.id);
      // Prime with new data
      context.todoLoader.prime(updatedTodo.id, updatedTodo);

      // Publish subscription event
      publishTodoUpdated(updatedTodo);
    }

    return updatedTodo;
  },

  /**
   * Delete a todo
   */
  async deleteTodo(
    _parent: unknown,
    args: { id: string },
    context: GraphQLContext
  ): Promise<boolean> {
    const deleted = await context.todoRepository.delete(args.id);

    if (deleted) {
      // Clear DataLoader cache
      context.todoLoader.clear(args.id);

      // Publish subscription event
      publishTodoDeleted(args.id);
    }

    return deleted;
  },

  /**
   * Toggle todo completion status
   */
  async toggleTodo(
    _parent: unknown,
    args: { id: string },
    context: GraphQLContext
  ): Promise<unknown> {
    // Fetch current todo
    const todo = await context.todoLoader.load(args.id);
    if (!todo) {
      throw new Error(`Todo with ID ${args.id} not found`);
    }

    // Toggle completed status
    const updatedTodo = await context.todoRepository.update(args.id, {
      completed: !todo.completed,
    });

    if (updatedTodo) {
      // Update cache
      context.todoLoader.clear(args.id);
      context.todoLoader.prime(updatedTodo.id, updatedTodo);

      // Publish subscription event
      publishTodoUpdated(updatedTodo);
    }

    return updatedTodo;
  },
};

/**
 * Subscription Resolvers
 */
const Subscription = {
  /**
   * Subscribe to all todo changes
   */
  todoChanged: {
    subscribe: (_parent: unknown, _args: unknown, context: GraphQLContext) => {
      return context.pubsub.asyncIterator([TODO_EVENTS.TODO_CHANGED]);
    },
  },

  /**
   * Subscribe to new todos only
   */
  todoCreated: {
    subscribe: (_parent: unknown, _args: unknown, context: GraphQLContext) => {
      return context.pubsub.asyncIterator([TODO_EVENTS.TODO_CREATED]);
    },
  },

  /**
   * Subscribe to todo updates only
   */
  todoUpdated: {
    subscribe: (_parent: unknown, _args: unknown, context: GraphQLContext) => {
      return context.pubsub.asyncIterator([TODO_EVENTS.TODO_UPDATED]);
    },
  },

  /**
   * Subscribe to todo deletions only
   */
  todoDeleted: {
    subscribe: (_parent: unknown, _args: unknown, context: GraphQLContext) => {
      return context.pubsub.asyncIterator([TODO_EVENTS.TODO_DELETED]);
    },
  },
};

/**
 * Combined resolvers export
 */
export const resolvers = {
  Query,
  Mutation,
  Subscription,
};
