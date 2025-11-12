import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { prisma } from '../lib/prisma';

describe('Todos API', () => {
  // Clean up the database before each test
  beforeEach(async () => {
    await prisma.todo.deleteMany();
  });

  // Disconnect from database after all tests
  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('GET /api/todos', () => {
    it('should return an empty array with pagination metadata initially', async () => {
      const response = await request(app).get('/api/todos');
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        data: [],
        meta: {
          total: 0,
          page: 1,
          limit: 10,
          totalPages: 0,
        },
      });
    });

    it('should return paginated todos', async () => {
      // Create some test todos
      await prisma.todo.createMany({
        data: [
          { title: 'Todo 1', completed: false },
          { title: 'Todo 2', completed: true },
          { title: 'Todo 3', completed: false },
        ],
      });

      const response = await request(app).get('/api/todos?page=1&limit=2');
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.meta).toEqual({
        total: 3,
        page: 1,
        limit: 2,
        totalPages: 2,
      });
    });
  });

  describe('POST /api/todos', () => {
    it('should create a new todo', async () => {
      const newTodo = { title: 'Test Todo', completed: false };
      const response = await request(app).post('/api/todos').send(newTodo);

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        id: expect.any(Number),
        title: 'Test Todo',
        completed: false,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });

    it('should return 400 if title is missing', async () => {
      const response = await request(app).post('/api/todos').send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 if title is empty string', async () => {
      const response = await request(app)
        .post('/api/todos')
        .send({ title: '' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should create a todo with default completed=false', async () => {
      const response = await request(app)
        .post('/api/todos')
        .send({ title: 'Test' });

      expect(response.status).toBe(201);
      expect(response.body.completed).toBe(false);
    });
  });

  describe('GET /api/todos/:id', () => {
    it('should return a todo by id', async () => {
      // Create a todo first
      const todo = await prisma.todo.create({
        data: { title: 'Test Todo', completed: false },
      });

      // Get the todo
      const response = await request(app).get(`/api/todos/${todo.id}`);
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: todo.id,
        title: 'Test Todo',
        completed: false,
      });
    });

    it('should return 404 for non-existent todo', async () => {
      const response = await request(app).get('/api/todos/999999');
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Todo not found');
    });

    it('should return 400 for invalid id format', async () => {
      const response = await request(app).get('/api/todos/invalid');
      expect(response.status).toBe(400);
    });
  });

  describe('PUT /api/todos/:id', () => {
    it('should update a todo', async () => {
      // Create a todo first
      const todo = await prisma.todo.create({
        data: { title: 'Test Todo', completed: false },
      });

      // Update the todo
      const response = await request(app)
        .put(`/api/todos/${todo.id}`)
        .send({ title: 'Updated Todo', completed: true });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: todo.id,
        title: 'Updated Todo',
        completed: true,
      });
    });

    it('should partially update a todo (title only)', async () => {
      const todo = await prisma.todo.create({
        data: { title: 'Test Todo', completed: false },
      });

      const response = await request(app)
        .put(`/api/todos/${todo.id}`)
        .send({ title: 'Updated Title' });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: todo.id,
        title: 'Updated Title',
        completed: false,
      });
    });

    it('should partially update a todo (completed only)', async () => {
      const todo = await prisma.todo.create({
        data: { title: 'Test Todo', completed: false },
      });

      const response = await request(app)
        .put(`/api/todos/${todo.id}`)
        .send({ completed: true });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: todo.id,
        title: 'Test Todo',
        completed: true,
      });
    });

    it('should return 404 for non-existent todo', async () => {
      const response = await request(app)
        .put('/api/todos/999999')
        .send({ title: 'Updated' });
      expect(response.status).toBe(404);
    });

    it('should return 400 for invalid id format', async () => {
      const response = await request(app)
        .put('/api/todos/invalid')
        .send({ title: 'Updated' });
      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /api/todos/:id', () => {
    it('should delete a todo', async () => {
      // Create a todo first
      const todo = await prisma.todo.create({
        data: { title: 'Test Todo', completed: false },
      });

      // Delete the todo
      const response = await request(app).delete(`/api/todos/${todo.id}`);
      expect(response.status).toBe(204);

      // Verify it's deleted
      const getResponse = await request(app).get(`/api/todos/${todo.id}`);
      expect(getResponse.status).toBe(404);
    });

    it('should return 404 for non-existent todo', async () => {
      const response = await request(app).delete('/api/todos/999999');
      expect(response.status).toBe(404);
    });

    it('should return 400 for invalid id format', async () => {
      const response = await request(app).delete('/api/todos/invalid');
      expect(response.status).toBe(400);
    });
  });
});
