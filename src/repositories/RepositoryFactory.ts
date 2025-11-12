import { getDatabaseType } from '../config/database';
import { ITodoRepository } from './TodoRepository.interface';
import { PrismaTodoRepository } from './PrismaTodoRepository';
import { MongooseTodoRepository } from './MongooseTodoRepository';
import logger from '../config/logger';

/**
 * Factory to create the appropriate repository based on DB_TYPE environment variable
 */
export class RepositoryFactory {
  private static todoRepository: ITodoRepository | null = null;

  /**
   * Get Todo repository instance (singleton pattern)
   * Returns PrismaTodoRepository for PostgreSQL or MongooseTodoRepository for MongoDB
   */
  static getTodoRepository(): ITodoRepository {
    if (this.todoRepository) {
      return this.todoRepository;
    }

    const dbType = getDatabaseType();

    if (dbType === 'mongodb') {
      this.todoRepository = new MongooseTodoRepository();
      logger.info('Using MongoDB repository');
    } else {
      this.todoRepository = new PrismaTodoRepository();
      logger.info('Using PostgreSQL repository');
    }

    return this.todoRepository;
  }

  /**
   * Reset the repository instance (useful for testing)
   */
  static reset(): void {
    this.todoRepository = null;
  }
}
