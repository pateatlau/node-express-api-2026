import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RepositoryFactory } from '../RepositoryFactory';
import { PrismaTodoRepository } from '../PrismaTodoRepository';
import { MongooseTodoRepository } from '../MongooseTodoRepository';
import * as database from '../../config/database';

// Mock the database module
vi.mock('../../config/database', () => ({
  getDatabaseType: vi.fn(),
}));

describe('RepositoryFactory', () => {
  beforeEach(() => {
    // Reset the singleton between tests
    RepositoryFactory.reset();
    vi.clearAllMocks();
  });

  describe('getTodoRepository', () => {
    it('should return PrismaTodoRepository when dbType is postgres', () => {
      vi.mocked(database.getDatabaseType).mockReturnValue('postgres');

      const repository = RepositoryFactory.getTodoRepository();

      expect(repository).toBeInstanceOf(PrismaTodoRepository);
    });

    it('should return MongooseTodoRepository when dbType is mongodb', () => {
      vi.mocked(database.getDatabaseType).mockReturnValue('mongodb');

      const repository = RepositoryFactory.getTodoRepository();

      expect(repository).toBeInstanceOf(MongooseTodoRepository);
    });

    it('should return same instance when called multiple times (singleton)', () => {
      vi.mocked(database.getDatabaseType).mockReturnValue('postgres');

      const repo1 = RepositoryFactory.getTodoRepository();
      const repo2 = RepositoryFactory.getTodoRepository();

      expect(repo1).toBe(repo2);
      expect(database.getDatabaseType).toHaveBeenCalledTimes(1);
    });

    it('should create new instance after reset', () => {
      vi.mocked(database.getDatabaseType).mockReturnValue('mongodb');

      const repo1 = RepositoryFactory.getTodoRepository();
      RepositoryFactory.reset();
      const repo2 = RepositoryFactory.getTodoRepository();

      expect(repo1).not.toBe(repo2);
      expect(database.getDatabaseType).toHaveBeenCalledTimes(2);
    });
  });
});
