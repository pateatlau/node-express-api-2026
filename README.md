# Todo Backend API

A production-ready Node.js + Express + TypeScript backend API with PostgreSQL, Prisma ORM, Zod validation, and comprehensive security middleware.

> **New to this project?** Start with [DEVELOPER_GUIDE.md](./docs/DEVELOPER_GUIDE.md) for complete setup and workflow instructions.

---

## Features

### Core Stack

- **Node.js 18+ with Express 4.18** - RESTful and GraphQL API framework
- **TypeScript 5.3** - Strict type safety throughout
- **API Options** - REST and/or GraphQL (switchable via environment variable)
  - **REST API** - Traditional RESTful endpoints with Zod validation
  - **GraphQL API** - Apollo Server v4 with subscriptions and DataLoader optimization
- **Database Support** - PostgreSQL 16 or MongoDB 7.0 (switchable via environment variable)
  - **PostgreSQL + Prisma ORM** - Type-safe queries with automated migrations
  - **MongoDB + Mongoose ODM** - Document-based storage with schema validation
- **Zod** - Runtime schema validation

### Security & Performance

- **Helmet** - Secure HTTP headers (CSP, HSTS, XSS protection)
- **CORS** - Configurable cross-origin resource sharing
- **Rate Limiting** - 100 requests per 15 minutes per IP
- **Compression** - Gzip response compression
- **Input Validation** - Comprehensive request validation with Zod

### Developer Experience

- **Hot Reload** - Instant updates with nodemon + tsx
- **Docker Compose** - Reproducible development environment
- **Swagger UI** - Interactive API documentation
- **Prisma Studio** - Visual database management
- **Vitest + Supertest** - Fast testing with excellent DX
- **ESLint + Prettier** - Automated code quality

---

## API Documentation

**REST API:**

- **Live Documentation:** http://localhost:4000/api-docs (Swagger UI)
- **Base URL:** http://localhost:4000/api

**GraphQL API:**

- **GraphQL Endpoint:** http://localhost:4000/graphql
- **WebSocket (Subscriptions):** ws://localhost:4000/graphql
- **Apollo Studio Sandbox:** https://studio.apollographql.com/sandbox/explorer
- **Examples & Testing Guide:** [GRAPHQL_EXAMPLES.md](./docs/GRAPHQL_EXAMPLES.md)

**System:**

- **Health Check:** http://localhost:4000/health

### API Type Configuration

You can choose which API(s) to enable via the `API_TYPE` environment variable:

```env
API_TYPE=both      # Both REST and GraphQL (default)
API_TYPE=rest      # REST API only
API_TYPE=graphql   # GraphQL API only
```

---

## API Endpoints

### REST API - Todos

| Method | Endpoint                     | Description            |
| ------ | ---------------------------- | ---------------------- |
| GET    | `/api/todos?page=1&limit=10` | List todos (paginated) |
| GET    | `/api/todos/:id`             | Get single todo        |
| POST   | `/api/todos`                 | Create new todo        |
| PUT    | `/api/todos/:id`             | Update todo            |
| DELETE | `/api/todos/:id`             | Delete todo            |

### GraphQL API

**Queries:**

- `todos` - List todos with filtering, sorting, and pagination
- `todo(id: ID!)` - Get single todo by ID
- `health` - Health check with database status

**Mutations:**

- `createTodo(input: CreateTodoInput!)` - Create new todo
- `updateTodo(id: ID!, input: UpdateTodoInput!)` - Update todo
- `deleteTodo(id: ID!)` - Delete todo
- `toggleTodo(id: ID!)` - Toggle completion status

**Subscriptions:**

- `todoChanged` - Subscribe to all todo changes (create/update/delete)
- `todoCreated` - Subscribe to new todos only
- `todoUpdated` - Subscribe to todo updates only
- `todoDeleted` - Subscribe to todo deletions only

**See [GRAPHQL_EXAMPLES.md](./docs/GRAPHQL_EXAMPLES.md) for complete query examples and testing instructions.**

### System

| Method | Endpoint  | Description                       |
| ------ | --------- | --------------------------------- |
| GET    | `/health` | Health check with database status |

### Example Response

**PostgreSQL (UUID format):**

```json
{
  "id": "d7997fac-e435-473e-a084-06c6e0432792",
  "title": "Learn Prisma",
  "completed": false,
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

**MongoDB (ObjectId format):**

```json
{
  "id": "691385f9946e0ccedc5c7888",
  "title": "Learn Prisma",
  "completed": false,
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

---

## Quick Start

### Using Docker (Recommended)

**Option 1: PostgreSQL (default)**

```bash
# Start everything with Docker
npm run docker:compose:dev

# Initialize database
npm run db:migrate
npm run db:seed

# Access your API
# → http://localhost:4000/api-docs
```

**Option 2: MongoDB**

```bash
# Start with MongoDB
DB_TYPE=mongodb npm run docker:compose:dev

# Seed MongoDB
npm run db:seed:mongo

# Access your API
# → http://localhost:4000/api-docs
```

### Switching Databases

Set the `DB_TYPE` environment variable in your `.env` file:

```env
# Use PostgreSQL
DB_TYPE=postgres
DATABASE_URL="postgresql://todouser:todopassword@postgres-dev:5432/tododb"

# OR use MongoDB
DB_TYPE=mongodb
MONGODB_URL="mongodb://todouser:todopassword@mongo-dev:27017/tododb?authSource=admin"
```

### Switching API Types

Set the `API_TYPE` environment variable in your `.env` file:

```env
# Both REST and GraphQL (default)
API_TYPE=both

# REST API only (no GraphQL)
API_TYPE=rest

# GraphQL API only (no REST)
API_TYPE=graphql
```

**For detailed setup, troubleshooting, and workflows:** See [DEVELOPER_GUIDE.md](./docs/DEVELOPER_GUIDE.md)

---

**For detailed setup, troubleshooting, and workflows:** See [DEVELOPER_GUIDE.md](./docs/DEVELOPER_GUIDE.md)

---

## Project Structure

```
node-express-api-2026/
├── prisma/
│   ├── schema.prisma       # PostgreSQL database schema
│   ├── migrations/         # Migration history (PostgreSQL)
│   └── seed.ts             # Sample data generator (PostgreSQL)
├── scripts/
│   └── seed-mongodb.ts     # MongoDB seeding script
├── src/
│   ├── config/
│   │   ├── apiType.ts      # API type selection logic
│   │   ├── database.ts     # Database connection factory
│   │   └── swagger.ts      # OpenAPI/Swagger config
│   ├── graphql/
│   │   ├── schema.ts       # GraphQL type definitions
│   │   ├── resolvers/      # GraphQL resolvers
│   │   │   └── todo.resolvers.ts
│   │   ├── context.ts      # GraphQL request context
│   │   ├── dataloader.ts   # DataLoader for query optimization
│   │   ├── pubsub.ts       # PubSub for subscriptions
│   │   ├── server.ts       # Apollo Server setup
│   │   └── index.ts        # GraphQL module exports
│   ├── lib/
│   │   └── prisma.ts       # Prisma client instance
│   ├── middleware/
│   │   ├── errorHandler.ts # Global error handling
│   │   └── validate.ts     # Zod validation middleware
│   ├── models/
│   │   └── mongoose/       # MongoDB models
│   │       └── Todo.model.ts
│   ├── repositories/
│   │   ├── TodoRepository.interface.ts   # Repository contract
│   │   ├── PrismaTodoRepository.ts       # PostgreSQL implementation
│   │   ├── MongooseTodoRepository.ts     # MongoDB implementation
│   │   └── RepositoryFactory.ts          # Database selection logic
│   ├── routes/
│   │   └── todos.ts        # Todo CRUD endpoints
│   ├── schemas/
│   │   └── todo.schema.ts  # Zod validation schemas
│   ├── __tests__/
│   │   └── todos.test.ts   # API integration tests
│   ├── app.ts              # Express app & middleware setup
│   └── index.ts            # HTTP server entry point
├── docker-compose.yml      # Production Docker config
├── docker-compose.dev.yml  # Development Docker config
└── package.json
```

---

## Database Schema

### PostgreSQL Schema (Prisma)

```prisma
model Todo {
  id        String   @id @default(uuid())
  title     String
  completed Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([completed])
  @@index([createdAt])
}
```

**Note:** PostgreSQL uses UUID (v4) for IDs, providing globally unique string identifiers similar to MongoDB's ObjectId format.

### MongoDB Schema (Mongoose)

```typescript
const TodoSchema = new Schema(
  {
    title: { type: String, required: true },
    completed: { type: Boolean, default: false },
  },
  {
    timestamps: true, // Auto-generates createdAt and updatedAt
  }
);

// Indexes for optimized queries
TodoSchema.index({ completed: 1 });
TodoSchema.index({ createdAt: -1 });
```

**Design Notes:**

- Both schemas maintain identical field structure for consistency
- **Consistent IDs**: PostgreSQL uses UUID strings, MongoDB uses ObjectId strings (both globally unique)
- **Consistent Seed Data**: Both databases are seeded with the same 20 todos (matching titles and completed status)
- Indexed `completed` and `createdAt` fields for optimized queries
- Automatic timestamp management
- Supports pagination with efficient skip/take queries (PostgreSQL) or limit/skip (MongoDB)
- Seamless database switching via environment variable with no API changes required

---

## Security Features

| Feature              | Implementation               | Protection                         |
| -------------------- | ---------------------------- | ---------------------------------- |
| **Helmet**           | Secure HTTP headers          | XSS, clickjacking, MIME sniffing   |
| **CORS**             | Origin whitelist             | Unauthorized cross-origin requests |
| **Rate Limiting**    | 100 req/15min per IP         | Brute force, DoS attacks           |
| **Input Validation** | Zod schemas                  | Injection, malformed data          |
| **Error Handling**   | Safe error messages          | Information disclosure             |
| **SQL Injection**    | Prisma parameterized queries | SQL injection attacks              |

---

## Testing

**Framework:** Vitest + Supertest  
**Strategy:** Integration tests with real database operations  
**Coverage:** All CRUD endpoints and edge cases

```bash
npm test              # Run all tests
npm run test:ui       # Interactive test UI
npm run test:coverage # Coverage report
```

Tests automatically handle database cleanup between runs.

---

## Docker Architecture

### Development

- **PostgreSQL 16 Alpine** with persistent volumes
- **MongoDB 7.0** with persistent volumes
- **Hot reload** via nodemon + volume mounts
- **Port mappings:** 4000 (API), 5432 (PostgreSQL), 27017 (MongoDB), 5555 (Prisma Studio), 9229 (Debugger)

### Production

- **Multi-stage build** for minimal image size
- **Non-root user** for security
- **Health checks** for orchestration readiness

---

## Deployment

### Environment Configuration

**PostgreSQL:**

```env
DB_TYPE=postgres
DATABASE_URL="postgresql://user:password@host:5432/database"
PORT=4000
NODE_ENV=production
CORS_ORIGIN="https://your-frontend-url.com"
```

**MongoDB:**

```env
DB_TYPE=mongodb
MONGODB_URL="mongodb://user:password@host:27017/database?authSource=admin"
PORT=4000
NODE_ENV=production
CORS_ORIGIN="https://your-frontend-url.com"
```

### Production Deployment Checklist

1. **Environment Setup**
   - Set `NODE_ENV=production`
   - Set `DB_TYPE` to your chosen database (`postgres` or `mongodb`)
   - Configure production database connection string
   - Set `CORS_ORIGIN` to your frontend domain

2. **Database Migration** (PostgreSQL only)

   ```bash
   npm run prisma:migrate:prod
   ```

   For MongoDB, ensure indexes are created on first connection (automatic).

3. **Application Build**

   ```bash
   npm run build
   npm start
   ```

4. **Monitoring** (Recommended)
   - Configure Winston logging endpoints
   - Set up health check monitoring
   - Enable error tracking (Sentry ready)

---

## Key Commands Reference

```bash
# Development
npm run dev                    # Start dev server
npm run docker:compose:dev     # Start with Docker

# Database - PostgreSQL
npm run db:migrate             # Apply migrations
npm run db:seed                # Add sample data
npm run db:studio              # Open database GUI
npm run db:reset               # Reset database

# Database - MongoDB
npm run db:seed:mongo          # Seed MongoDB with sample data
npm run mongo:seed             # Alternative MongoDB seed command

# Quality Assurance
npm test                       # Run tests
npm run lint                   # Check code quality
npm run type-check             # Validate types

# Production
npm run build                  # Build for production
npm start                      # Start production server
```

**Full command reference:** See [DEVELOPER_GUIDE.md](./docs/DEVELOPER_GUIDE.md)

---

## Technology Versions

- Node.js: 18+
- TypeScript: 5.3
- Express: 4.18
- Apollo Server: 4.12
- GraphQL: 16.9
- PostgreSQL: 16 (optional)
- MongoDB: 7.0 (optional)
- Prisma: 6.19
- Mongoose: 8.0
- Zod: 4.1
- Vitest: 4.0

---

## Additional Information

- **Pagination:** Default 10 items per page, configurable via query params
- **Logging:** Winston configured for structured logging (production-ready)
- **API Docs:** Auto-generated from JSDoc comments in route handlers
- **Hot Reload:** Automatic restart on file changes in development
- **Type Safety:** Full TypeScript coverage with strict mode enabled

---

## Contributing

1. Fork and create a feature branch
2. Write tests for new functionality
3. Ensure all tests pass: `npm test`
4. Validate code quality: `npm run lint && npm run type-check`
5. Submit a pull request with clear description

---

## License

MIT

---

## Related Documentation

- [DEVELOPER_GUIDE.md](./docs/DEVELOPER_GUIDE.md) - Setup, workflows, and troubleshooting
- [GRAPHQL_EXAMPLES.md](./docs/GRAPHQL_EXAMPLES.md) - GraphQL queries, mutations, and subscriptions
- **[AUTHENTICATION.md](./docs/AUTHENTICATION.md)** - JWT authentication strategy and implementation
- **[AUTHENTICATION_QUICK_START.md](./docs/AUTHENTICATION_QUICK_START.md)** - Quick setup guide for authentication
- **[AUTHENTICATION_CHECKLIST.md](./docs/AUTHENTICATION_CHECKLIST.md)** - Implementation progress tracker
- [prisma/schema.prisma](./prisma/schema.prisma) - Database schema definitions
- [Swagger UI](http://localhost:4000/api-docs) - Interactive REST API documentation (when running)
- [Apollo Studio](http://localhost:4000/graphql) - Interactive GraphQL playground (when running)
