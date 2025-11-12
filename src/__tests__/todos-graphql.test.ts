import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createServer } from 'http';
import app from '../app';
import { RepositoryFactory } from '../repositories/RepositoryFactory';
import { setupGraphQLServer } from '../graphql';
import type { TodoDTO } from '../repositories/TodoRepository.interface';

describe('GraphQL API - Todos', () => {
  let todoRepository: ReturnType<typeof RepositoryFactory.getTodoRepository>;
  let httpServer: ReturnType<typeof createServer>;

  beforeEach(async () => {
    todoRepository = RepositoryFactory.getTodoRepository();
    httpServer = createServer(app);

    // Setup GraphQL server
    await setupGraphQLServer(app, httpServer);

    // Clean up todos before each test
    const todos = await todoRepository.findAll({ skip: 0, take: 1000 });
    for (const todo of todos) {
      await todoRepository.delete(todo.id);
    }
  });

  describe('Queries', () => {
    describe('todos', () => {
      it('should return empty array when no todos exist', async () => {
        const query = `
          query {
            todos(page: 1, limit: 10) {
              data {
                id
                title
                completed
              }
              meta {
                total
                page
                limit
              }
            }
          }
        `;

        const response = await request(app).post('/graphql').send({ query }).expect(200);

        expect(response.body.data.todos.data).toEqual([]);
        expect(response.body.data.todos.meta.total).toBe(0);
      });

      it('should return todos with pagination', async () => {
        // Create test todos
        await todoRepository.create({ title: 'Test 1', completed: false });
        await todoRepository.create({ title: 'Test 2', completed: true });
        await todoRepository.create({ title: 'Test 3', completed: false });

        const query = `
          query {
            todos(page: 1, limit: 2) {
              data {
                id
                title
                completed
              }
              meta {
                total
                page
                limit
                totalPages
              }
            }
          }
        `;

        const response = await request(app).post('/graphql').send({ query }).expect(200);

        expect(response.body.data.todos.data).toHaveLength(2);
        expect(response.body.data.todos.meta.total).toBe(3);
        expect(response.body.data.todos.meta.page).toBe(1);
        expect(response.body.data.todos.meta.totalPages).toBe(2);
      });

      it('should filter by completed status', async () => {
        await todoRepository.create({ title: 'Todo 1', completed: false });
        await todoRepository.create({ title: 'Todo 2', completed: true });
        await todoRepository.create({ title: 'Todo 3', completed: true });

        const query = `
          query {
            todos(filter: { completed: true }) {
              data {
                id
                title
                completed
              }
            }
          }
        `;

        const response = await request(app).post('/graphql').send({ query }).expect(200);

        expect(response.body.data.todos.data).toHaveLength(2);
        expect(
          response.body.data.todos.data.every((todo: TodoDTO) => todo.completed === true)
        ).toBe(true);
      });

      it('should filter by title search', async () => {
        await todoRepository.create({
          title: 'Buy groceries',
          completed: false,
        });
        await todoRepository.create({ title: 'Buy coffee', completed: false });
        await todoRepository.create({ title: 'Clean house', completed: false });

        const query = `
          query {
            todos(filter: { titleContains: "Buy" }) {
              data {
                id
                title
              }
            }
          }
        `;

        const response = await request(app).post('/graphql').send({ query }).expect(200);

        expect(response.body.data.todos.data).toHaveLength(2);
        expect(
          response.body.data.todos.data.every((todo: TodoDTO) => todo.title.includes('Buy'))
        ).toBe(true);
      });

      it('should sort todos', async () => {
        await todoRepository.create({ title: 'Charlie', completed: false });
        await todoRepository.create({ title: 'Alice', completed: false });
        await todoRepository.create({ title: 'Bob', completed: false });

        const query = `
          query {
            todos(sortBy: title, sortOrder: ASC) {
              data {
                title
              }
            }
          }
        `;

        const response = await request(app).post('/graphql').send({ query }).expect(200);

        const titles = response.body.data.todos.data.map((t: TodoDTO) => t.title);
        expect(titles).toEqual(['Alice', 'Bob', 'Charlie']);
      });
    });

    describe('todo', () => {
      it('should return a single todo by id', async () => {
        const created = await todoRepository.create({
          title: 'Test Todo',
          completed: false,
        });

        const query = `
          query {
            todo(id: "${created.id}") {
              id
              title
              completed
            }
          }
        `;

        const response = await request(app).post('/graphql').send({ query }).expect(200);

        expect(response.body.data.todo.id).toBe(created.id);
        expect(response.body.data.todo.title).toBe(created.title);
      });

      it('should return null for non-existent todo', async () => {
        const fakeId = '00000000-0000-0000-0000-000000000000';
        const query = `
          query {
            todo(id: "${fakeId}") {
              id
            }
          }
        `;

        const response = await request(app).post('/graphql').send({ query }).expect(200);

        expect(response.body.data.todo).toBeNull();
      });
    });

    describe('health', () => {
      it('should return health status', async () => {
        const query = `
          query {
            health {
              status
              database
              dbType
            }
          }
        `;

        const response = await request(app).post('/graphql').send({ query }).expect(200);

        expect(response.body.data.health.status).toBe('ok');
        expect(response.body.data.health.database).toBe('connected');
        expect(response.body.data.health).toHaveProperty('dbType');
      });
    });
  });

  describe('Mutations', () => {
    describe('createTodo', () => {
      it('should create a new todo', async () => {
        const mutation = `
          mutation {
            createTodo(input: { title: "New Todo", completed: false }) {
              id
              title
              completed
              createdAt
              updatedAt
            }
          }
        `;

        const response = await request(app).post('/graphql').send({ query: mutation }).expect(200);

        expect(response.body.data.createTodo).toHaveProperty('id');
        expect(response.body.data.createTodo.title).toBe('New Todo');
        expect(response.body.data.createTodo.completed).toBe(false);
      });

      it('should validate required title', async () => {
        const mutation = `
          mutation {
            createTodo(input: { title: "", completed: false }) {
              id
            }
          }
        `;

        const response = await request(app).post('/graphql').send({ query: mutation }).expect(200);

        expect(response.body.errors).toBeDefined();
      });
    });

    describe('updateTodo', () => {
      it('should update a todo', async () => {
        const created = await todoRepository.create({
          title: 'Original',
          completed: false,
        });

        const mutation = `
          mutation {
            updateTodo(id: "${created.id}", input: { title: "Updated", completed: true }) {
              id
              title
              completed
            }
          }
        `;

        const response = await request(app).post('/graphql').send({ query: mutation }).expect(200);

        expect(response.body.data.updateTodo.title).toBe('Updated');
        expect(response.body.data.updateTodo.completed).toBe(true);
      });

      it('should return error for non-existent todo', async () => {
        const fakeId = '00000000-0000-0000-0000-000000000000';
        const mutation = `
          mutation {
            updateTodo(id: "${fakeId}", input: { title: "Updated" }) {
              id
            }
          }
        `;

        const response = await request(app).post('/graphql').send({ query: mutation }).expect(200);

        expect(response.body.errors).toBeDefined();
      });
    });

    describe('toggleTodo', () => {
      it('should toggle todo completion status', async () => {
        const created = await todoRepository.create({
          title: 'Test',
          completed: false,
        });

        const mutation = `
          mutation {
            toggleTodo(id: "${created.id}") {
              id
              completed
            }
          }
        `;

        const response = await request(app).post('/graphql').send({ query: mutation }).expect(200);

        expect(response.body.data.toggleTodo.completed).toBe(true);

        // Toggle again
        const response2 = await request(app).post('/graphql').send({ query: mutation }).expect(200);

        expect(response2.body.data.toggleTodo.completed).toBe(false);
      });
    });

    describe('deleteTodo', () => {
      it('should delete a todo', async () => {
        const created = await todoRepository.create({
          title: 'To Delete',
          completed: false,
        });

        const mutation = `
          mutation {
            deleteTodo(id: "${created.id}")
          }
        `;

        const response = await request(app).post('/graphql').send({ query: mutation }).expect(200);

        expect(response.body.data.deleteTodo).toBe(true);

        // Verify deletion
        const deleted = await todoRepository.findById(created.id);
        expect(deleted).toBeNull();
      });

      it('should return error for non-existent todo', async () => {
        const fakeId = '00000000-0000-0000-0000-000000000000';
        const mutation = `
          mutation {
            deleteTodo(id: "${fakeId}")
          }
        `;

        const response = await request(app).post('/graphql').send({ query: mutation }).expect(200);

        expect(response.body.errors).toBeDefined();
      });
    });
  });
});
