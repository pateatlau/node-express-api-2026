import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MongooseTodoRepository } from '../MongooseTodoRepository';
import { TodoModel } from '../../models/mongoose/Todo.model';

// Mock Mongoose model
vi.mock('../../models/mongoose/Todo.model', () => ({
  TodoModel: {
    find: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    findByIdAndDelete: vi.fn(),
    countDocuments: vi.fn(),
  },
}));

describe('MongooseTodoRepository', () => {
  let repository: MongooseTodoRepository;

  beforeEach(() => {
    repository = new MongooseTodoRepository();
    vi.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return paginated todos', async () => {
      const mockTodos = [
        {
          _id: '507f1f77bcf86cd799439011',
          title: 'Test Todo 1',
          completed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          toObject: function () {
            return {
              id: this._id,
              title: this.title,
              completed: this.completed,
              createdAt: this.createdAt,
              updatedAt: this.updatedAt,
            };
          },
        },
        {
          _id: '507f1f77bcf86cd799439012',
          title: 'Test Todo 2',
          completed: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          toObject: function () {
            return {
              id: this._id,
              title: this.title,
              completed: this.completed,
              createdAt: this.createdAt,
              updatedAt: this.updatedAt,
            };
          },
        },
      ];

      const mockQuery = {
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        lean: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue(mockTodos),
      };

      vi.mocked(TodoModel.find).mockReturnValue(mockQuery as never);

      const result = await repository.findAll({ skip: 0, take: 10 });

      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('Test Todo 1');
      expect(TodoModel.find).toHaveBeenCalled();
      expect(mockQuery.sort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(mockQuery.skip).toHaveBeenCalledWith(0);
      expect(mockQuery.limit).toHaveBeenCalledWith(10);
    });

    it('should apply pagination parameters', async () => {
      const mockQuery = {
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        lean: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([]),
      };

      vi.mocked(TodoModel.find).mockReturnValue(mockQuery as never);

      await repository.findAll({ skip: 20, take: 5 });

      expect(mockQuery.skip).toHaveBeenCalledWith(20);
      expect(mockQuery.limit).toHaveBeenCalledWith(5);
    });
  });

  describe('findById', () => {
    it('should return a todo when found', async () => {
      const mockTodo = {
        _id: '507f1f77bcf86cd799439011',
        title: 'Test Todo',
        completed: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        toObject: function () {
          return {
            id: this._id,
            title: this.title,
            completed: this.completed,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
          };
        },
      };

      const mockQuery = {
        lean: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue(mockTodo),
      };

      vi.mocked(TodoModel.findById).mockReturnValue(mockQuery as never);

      const result = await repository.findById('507f1f77bcf86cd799439011');

      expect(result).toBeDefined();
      expect(result?.id).toBe('507f1f77bcf86cd799439011');
      expect(result?.title).toBe('Test Todo');
      expect(TodoModel.findById).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
    });

    it('should return null when todo not found', async () => {
      const mockQuery = {
        lean: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue(null),
      };

      vi.mocked(TodoModel.findById).mockReturnValue(mockQuery as never);

      const result = await repository.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should create a new todo', async () => {
      const now = new Date();
      const mockCreated = {
        _id: '507f1f77bcf86cd799439011',
        title: 'New Todo',
        completed: false,
        createdAt: now,
        updatedAt: now,
        toObject: function () {
          return {
            id: this._id,
            title: this.title,
            completed: this.completed,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
          };
        },
      };

      vi.mocked(TodoModel.create).mockResolvedValue(mockCreated as never);

      const result = await repository.create({
        title: 'New Todo',
        completed: false,
      });

      expect(result).toBeDefined();
      expect(result.id).toBe('507f1f77bcf86cd799439011');
      expect(result.title).toBe('New Todo');
      expect(result.completed).toBe(false);
      expect(TodoModel.create).toHaveBeenCalledWith({
        title: 'New Todo',
        completed: false,
      });
    });
  });

  describe('update', () => {
    it('should update an existing todo', async () => {
      const now = new Date();
      const mockUpdated = {
        _id: '507f1f77bcf86cd799439011',
        title: 'Updated Todo',
        completed: true,
        createdAt: now,
        updatedAt: now,
        toObject: function () {
          return {
            id: this._id,
            title: this.title,
            completed: this.completed,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
          };
        },
      };

      const mockQuery = {
        lean: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue(mockUpdated),
      };

      vi.mocked(TodoModel.findByIdAndUpdate).mockReturnValue(mockQuery as never);

      const result = await repository.update('507f1f77bcf86cd799439011', {
        title: 'Updated Todo',
        completed: true,
      });

      expect(result).toBeDefined();
      expect(result?.title).toBe('Updated Todo');
      expect(result?.completed).toBe(true);
      expect(TodoModel.findByIdAndUpdate).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
        {
          title: 'Updated Todo',
          completed: true,
        },
        { new: true, runValidators: true }
      );
    });

    it('should return null when updating nonexistent todo', async () => {
      const mockQuery = {
        lean: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue(null),
      };

      vi.mocked(TodoModel.findByIdAndUpdate).mockReturnValue(mockQuery as never);

      const result = await repository.update('nonexistent', {
        title: 'Updated',
      });

      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete a todo and return true', async () => {
      const mockDeleted = {
        _id: '507f1f77bcf86cd799439011',
        title: 'To Delete',
        completed: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockQuery = {
        exec: vi.fn().mockResolvedValue(mockDeleted),
      };

      vi.mocked(TodoModel.findByIdAndDelete).mockReturnValue(mockQuery as never);

      const result = await repository.delete('507f1f77bcf86cd799439011');

      expect(result).toBe(true);
      expect(TodoModel.findByIdAndDelete).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
    });

    it('should return false when deleting nonexistent todo', async () => {
      const mockQuery = {
        exec: vi.fn().mockResolvedValue(null),
      };

      vi.mocked(TodoModel.findByIdAndDelete).mockReturnValue(mockQuery as never);

      const result = await repository.delete('nonexistent');

      expect(result).toBe(false);
    });
  });
});
