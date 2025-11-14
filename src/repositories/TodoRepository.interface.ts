/**
 * Common Todo type for both database implementations
 * This normalizes the difference between Prisma (id: number) and Mongoose (_id: ObjectId)
 */
export interface TodoDTO {
  id: string;
  title: string;
  completed: boolean;
  userId?: string; // Optional for backward compatibility
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Data required to create a new Todo
 */
export interface CreateTodoDTO {
  title: string;
  completed?: boolean;
  userId?: string; // Optional user association
}

/**
 * Data that can be updated in a Todo
 */
export interface UpdateTodoDTO {
  title?: string;
  completed?: boolean;
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  skip: number;
  take: number;
  userId?: string; // Optional user filter
}

/**
 * Repository interface for Todo operations
 * Both Prisma and Mongoose implementations must conform to this interface
 */
export interface ITodoRepository {
  /**
   * Find all todos with pagination and optional user filter
   * @param params - Pagination parameters (skip, take) and optional userId
   */
  findAll(params: PaginationParams): Promise<TodoDTO[]>;

  /**
   * Find a todo by ID
   * @param id - Todo ID
   * @param userId - Optional userId to verify ownership
   */
  findById(id: string, userId?: string): Promise<TodoDTO | null>;

  /**
   * Create a new todo
   * @param data - Todo creation data
   */
  create(data: CreateTodoDTO): Promise<TodoDTO>;

  /**
   * Update a todo
   * @param id - Todo ID
   * @param data - Todo update data
   * @param userId - Optional userId to verify ownership
   */
  update(id: string, data: UpdateTodoDTO, userId?: string): Promise<TodoDTO | null>;

  /**
   * Delete a todo
   * @param id - Todo ID
   * @param userId - Optional userId to verify ownership
   */
  delete(id: string, userId?: string): Promise<boolean>;

  /**
   * Count total todos (useful for pagination)
   * @param userId - Optional userId to count only user's todos
   */
  count(userId?: string): Promise<number>;
}
