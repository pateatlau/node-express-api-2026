/**
 * Common Todo type for both database implementations
 * This normalizes the difference between Prisma (id: number) and Mongoose (_id: ObjectId)
 */
export interface TodoDTO {
  id: string;
  title: string;
  completed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Data required to create a new Todo
 */
export interface CreateTodoDTO {
  title: string;
  completed?: boolean;
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
}

/**
 * Repository interface for Todo operations
 * Both Prisma and Mongoose implementations must conform to this interface
 */
export interface ITodoRepository {
  /**
   * Find all todos with pagination
   * @param params - Pagination parameters (skip, take)
   */
  findAll(params: PaginationParams): Promise<TodoDTO[]>;

  /**
   * Find a todo by ID
   * @param id - Todo ID
   */
  findById(id: string): Promise<TodoDTO | null>;

  /**
   * Create a new todo
   * @param data - Todo creation data
   */
  create(data: CreateTodoDTO): Promise<TodoDTO>;

  /**
   * Update a todo
   * @param id - Todo ID
   * @param data - Todo update data
   */
  update(id: string, data: UpdateTodoDTO): Promise<TodoDTO | null>;

  /**
   * Delete a todo
   * @param id - Todo ID
   */
  delete(id: string): Promise<boolean>;

  /**
   * Count total todos (useful for pagination)
   */
  count(): Promise<number>;
}
