import swaggerJsdoc from 'swagger-jsdoc';
import { version } from '../../package.json';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Todo API',
      version,
      description:
        'A RESTful API for managing todos built with Node.js, Express, PostgreSQL, and Prisma',
      contact: {
        name: 'API Support',
      },
    },
    servers: [
      {
        url: 'http://localhost:4000',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT token',
        },
      },
      schemas: {
        Todo: {
          type: 'object',
          required: ['id', 'title', 'completed', 'createdAt', 'updatedAt'],
          properties: {
            id: {
              type: 'integer',
              description: 'The auto-generated id of the todo',
            },
            title: {
              type: 'string',
              description: 'The title of the todo',
            },
            completed: {
              type: 'boolean',
              description: 'The completion status of the todo',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'The date the todo was created',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'The date the todo was last updated',
            },
          },
        },
        CreateTodoInput: {
          type: 'object',
          required: ['title'],
          properties: {
            title: {
              type: 'string',
              minLength: 1,
              maxLength: 255,
              description: 'The title of the todo',
            },
            completed: {
              type: 'boolean',
              default: false,
              description: 'The completion status of the todo',
            },
          },
        },
        UpdateTodoInput: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              minLength: 1,
              maxLength: 255,
              description: 'The title of the todo',
            },
            completed: {
              type: 'boolean',
              description: 'The completion status of the todo',
            },
          },
        },
        PaginatedTodos: {
          type: 'object',
          properties: {
            data: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/Todo',
              },
            },
            meta: {
              type: 'object',
              properties: {
                total: {
                  type: 'integer',
                },
                page: {
                  type: 'integer',
                },
                limit: {
                  type: 'integer',
                },
                totalPages: {
                  type: 'integer',
                },
              },
            },
          },
        },
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error message',
            },
          },
        },
        ValidationError: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              example: 'Validation failed',
            },
            details: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: {
                    type: 'string',
                    example: 'title',
                  },
                  message: {
                    type: 'string',
                    example: 'Title is required',
                  },
                },
              },
            },
          },
        },
      },
      responses: {
        UnauthorizedError: {
          description: 'Authentication token is missing or invalid',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                error: 'Unauthorized',
              },
            },
          },
        },
        NotFoundError: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                error: 'Todo not found',
              },
            },
          },
        },
        RateLimitError: {
          description: 'Too many requests',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: {
                    type: 'string',
                    example: 'Too many requests',
                  },
                  message: {
                    type: 'string',
                    example: 'Please try again later.',
                  },
                  retryAfter: {
                    type: 'string',
                    example: '1234567890',
                  },
                },
              },
            },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
    tags: [
      {
        name: 'Todos',
        description: 'Todo management endpoints',
      },
      {
        name: 'Health',
        description: 'Health check endpoints',
      },
    ],
  },
  apis: ['./src/routes/*.ts', './src/app.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
