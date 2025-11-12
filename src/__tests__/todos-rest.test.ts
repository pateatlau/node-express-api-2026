import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app';
import { RepositoryFactory } from '../repositories/RepositoryFactory';
import type { TodoDTO } from '../repositories/TodoRepository.interface';

describe('REST API - Todos', () => {
  let todoRepository: ReturnType<typeof RepositoryFactory.getTodoRepository>;

  beforeEach(async () => {
    todoRepository = RepositoryFactory.getTodoRepository();

    // Clean up todos before each test
    const todos = await todoRepository.findAll({ skip: 0, take: 1000 });
    for (const todo of todos) {
      await todoRepository.delete(todo.id);
    }
  });

  describe('GET /api/todos', () => {
    it('should return empty array when no todos exist', async () => {
      const response = await request(app).get('/api/todos').expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toEqual([]);
      expect(response.body.meta.total).toBe(0);
    });

    it('should return todos with pagination', async () => {
      // Create test todos
      await todoRepository.create({ title: 'Test 1', completed: false });
      await todoRepository.create({ title: 'Test 2', completed: true });
      await todoRepository.create({ title: 'Test 3', completed: false });

      const response = await request(app).get('/api/todos?page=1&limit=2').expect(200);

      expect(response.body.data).toHaveLength(2);
      expect(response.body.meta.total).toBe(3);
      expect(response.body.meta.page).toBe(1);
      expect(response.body.meta.limit).toBe(2);
      expect(response.body.meta.totalPages).toBe(2);
    });

    it('should filter by completed status', async () => {
      await todoRepository.create({ title: 'Todo 1', completed: false });
      await todoRepository.create({ title: 'Todo 2', completed: true });
      await todoRepository.create({ title: 'Todo 3', completed: true });

      const response = await request(app).get('/api/todos?completed=true').expect(200);

      expect(response.body.data).toHaveLength(2);
      expect(response.body.data.every((todo: TodoDTO) => todo.completed === true)).toBe(true);
    });
  });

  describe('POST /api/todos', () => {
    it('should create a new todo', async () => {
      const newTodo = {
        title: 'New Test Todo',
        completed: false,
      };

      const response = await request(app).post('/api/todos').send(newTodo).expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.title).toBe(newTodo.title);
      expect(response.body.completed).toBe(newTodo.completed);
      expect(response.body).toHaveProperty('createdAt');
      expect(response.body).toHaveProperty('updatedAt');
    });

    it('should validate required title field', async () => {
      const response = await request(app).post('/api/todos').send({ completed: false }).expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should validate title minimum length', async () => {
      const response = await request(app)
        .post('/api/todos')
        .send({ title: '', completed: false })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/todos/:id', () => {
    it('should return a todo by id', async () => {
      const created = await todoRepository.create({
        title: 'Test Todo',
        completed: false,
      });

      const response = await request(app).get(`/api/todos/${created.id}`).expect(200);

      expect(response.body.id).toBe(created.id);
      expect(response.body.title).toBe(created.title);
    });

    it('should return 404 for non-existent todo', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      await request(app).get(`/api/todos/${fakeId}`).expect(404);
    });
  });

  describe('PUT /api/todos/:id', () => {
    it('should update a todo', async () => {
      const created = await todoRepository.create({
        title: 'Original Title',
        completed: false,
      });

      const updates = {
        title: 'Updated Title',
        completed: true,
      };

      const response = await request(app).put(`/api/todos/${created.id}`).send(updates).expect(200);

      expect(response.body.title).toBe(updates.title);
      expect(response.body.completed).toBe(updates.completed);
    });

    it('should return 404 when updating non-existent todo', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      await request(app)
        .put(`/api/todos/${fakeId}`)
        .send({ title: 'Updated', completed: true })
        .expect(404);
    });
  });

  describe('DELETE /api/todos/:id', () => {
    it('should delete a todo', async () => {
      const created = await todoRepository.create({
        title: 'To Delete',
        completed: false,
      });

      await request(app).delete(`/api/todos/${created.id}`).expect(204);

      // Verify deletion
      const deleted = await todoRepository.findById(created.id);
      expect(deleted).toBeNull();
    });

    it('should return 404 when deleting non-existent todo', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      await request(app).delete(`/api/todos/${fakeId}`).expect(404);
    });
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body.status).toBe('ok');
      expect(response.body).toHaveProperty('database');
    });
  });
});
