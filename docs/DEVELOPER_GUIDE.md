# Developer Guide

> Practical guide for daily development workflows and troubleshooting

**Quick Access:**

- API Server: http://localhost:4000
- API Documentation: http://localhost:4000/api-docs
- Database GUI: http://localhost:5555
- Health Check: http://localhost:4000/health

**First time here?** Start with the [Getting Started](#getting-started) section below.

---

## Getting Started

### First Time Setup

**Option 1: PostgreSQL (Default)**

**Step 1: Start the containers**

```bash
npm run docker:compose:dev
```

**Step 2: Initialize the database**

```bash
npm run db:migrate
npm run db:seed
```

**Step 3: Verify the installation**

- Visit http://localhost:4000/health to confirm API is running
- Visit http://localhost:4000/api-docs to explore endpoints
- Run `npm run db:studio` to view database at http://localhost:5555

---

**Option 2: MongoDB**

**Step 1: Set environment variable**

Create a `.env` file:

```env
DB_TYPE=mongodb
MONGODB_URL="mongodb://todouser:todopassword@mongo-dev:27017/tododb?authSource=admin"
```

**Step 2: Start the containers**

```bash
npm run docker:compose:dev
```

**Step 3: Seed the database**

```bash
npm run db:seed:mongo
```

**Step 4: Verify the installation**

- Visit http://localhost:4000/health to confirm API is running
- Visit http://localhost:4000/api-docs to explore endpoints

---

### Switching Between Databases

The API supports seamless switching between PostgreSQL and MongoDB with no code changes required. Both databases contain identical seed data for consistency.

Edit your `.env` file or `docker-compose.dev.yml`:

```env
# For PostgreSQL (uses UUID for IDs)
DB_TYPE=postgres
DATABASE_URL="postgresql://todouser:todopassword@postgres-dev:5432/tododb"

# For MongoDB (uses ObjectId for IDs)
DB_TYPE=mongodb
MONGODB_URL="mongodb://todouser:todopassword@mongo-dev:27017/tododb?authSource=admin"
```

Then restart containers:

```bash
npm run docker:compose:down
npm run docker:compose:dev
```

**Data Consistency:**

- Both databases are seeded with the same 20 todos (matching titles and completed status)
- PostgreSQL uses UUID format IDs: `d7997fac-e435-473e-a084-06c6e0432792`
- MongoDB uses ObjectId format IDs: `691385f9946e0ccedc5c7888`
- All API responses maintain the same structure regardless of database

---

### Switching Between API Types

The API supports REST, GraphQL, or both APIs running simultaneously. Switch using the `API_TYPE` environment variable.

Edit your `.env` file or `docker-compose.dev.yml`:

```env
# Both REST and GraphQL (default)
API_TYPE=both

# REST API only (no GraphQL endpoint)
API_TYPE=rest

# GraphQL API only (no REST endpoints)
API_TYPE=graphql
```

Then restart containers:

```bash
npm run docker:compose:down
npm run docker:compose:dev
```

**API Endpoints by Type:**

| API_TYPE  | REST Endpoint | GraphQL Endpoint | WebSocket |
| --------- | ------------- | ---------------- | --------- |
| `both`    | ✅ /api/todos | ✅ /graphql      | ✅        |
| `rest`    | ✅ /api/todos | ❌               | ❌        |
| `graphql` | ❌            | ✅ /graphql      | ✅        |

---

## GraphQL Quick Start

### Testing with Apollo Studio

1. **Start the server** (if not running):

   ```bash
   npm run docker:compose:dev
   ```

2. **Open Apollo Studio Sandbox** in your browser:
   - Visit https://studio.apollographql.com/sandbox/explorer
   - Or access directly: http://localhost:4000/graphql

3. **Connect to your endpoint**:
   - Enter `http://localhost:4000/graphql` in the connection bar

4. **Try a basic query**:

   ```graphql
   query {
     todos(page: 1, limit: 5) {
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
   ```

5. **Create a todo**:
   ```graphql
   mutation {
     createTodo(input: { title: "Test GraphQL", completed: false }) {
       id
       title
       completed
       createdAt
     }
   }
   ```

**For more examples:** See [GRAPHQL_EXAMPLES.md](./GRAPHQL_EXAMPLES.md)

### Testing Subscriptions

GraphQL subscriptions provide real-time updates via WebSocket.

1. **Open Apollo Studio Sandbox** and connect to `http://localhost:4000/graphql`

2. **Subscribe to all changes**:

   ```graphql
   subscription {
     todoChanged {
       operation
       todo {
         id
         title
         completed
       }
       deletedId
     }
   }
   ```

3. **In another browser tab**, create/update/delete a todo

4. **Watch the subscription** automatically receive the event in real-time

**WebSocket endpoint:** `ws://localhost:4000/graphql`

### Daily Workflow

```bash
# Start development environment
npm run docker:compose:dev:bg    # Start in background

# Open database GUI
npm run db:studio                # Browse data at localhost:5555

# Stop when done
npm run docker:compose:down      # Stop all services
```

---

## Available Commands

### Container Management

```bash
npm run docker:compose:dev        # Start with logs (foreground)
npm run docker:compose:dev:bg     # Start in background
npm run docker:compose:down       # Stop all containers
npm run docker:compose:logs:dev   # View container logs
```

### Database Operations

> **Important:** Containers must be running before executing these commands

**PostgreSQL Commands:**

```bash
npm run db:migrate    # Apply schema migrations
npm run db:seed       # Populate with sample data (20 todos, same as MongoDB)
npm run db:studio     # Open Prisma Studio at localhost:5555
npm run db:reset      # Reset database (drop + migrate + seed)
```

**MongoDB Commands:**

```bash
npm run db:seed:mongo # Seed MongoDB with sample data (20 todos, same as PostgreSQL)
npm run mongo:seed    # Alternative MongoDB seed command
```

> **Note:** Both databases are seeded with identical data (same 20 todos with matching titles and completed status) to ensure consistency when switching between databases.

> **Warning:** `db:reset` will permanently delete all data. Use only in development.

### Development Tools

```bash
npm test              # Run test suite
npm run test:ui       # Run tests with interactive UI
npm run test:coverage # Generate coverage report
npm run lint          # Check code quality
npm run format        # Auto-format code
npm run type-check    # Validate TypeScript types
```

---

## Testing Your API

### Using Swagger UI (Recommended)

Visit http://localhost:4000/api-docs for an interactive interface where you can test all endpoints visually.

### Using curl

```bash
# List all todos (with pagination)
curl http://localhost:4000/api/todos

# Get a specific todo (PostgreSQL with UUID)
curl http://localhost:4000/api/todos/d7997fac-e435-473e-a084-06c6e0432792

# Get a specific todo (MongoDB with ObjectId)
curl http://localhost:4000/api/todos/691385f9946e0ccedc5c7888

# Create a new todo
curl -X POST http://localhost:4000/api/todos \
  -H "Content-Type: application/json" \
  -d '{"title": "Buy groceries", "completed": false}'

# Update a todo (use UUID for PostgreSQL, ObjectId for MongoDB)
curl -X PUT http://localhost:4000/api/todos/d7997fac-e435-473e-a084-06c6e0432792 \
  -H "Content-Type: application/json" \
  -d '{"completed": true}'

# Delete a todo
curl -X DELETE http://localhost:4000/api/todos/d7997fac-e435-473e-a084-06c6e0432792
```

> **Note:** PostgreSQL uses UUID format IDs (e.g., `d7997fac-e435-473e-a084-06c6e0432792`), while MongoDB uses ObjectId format (e.g., `691385f9946e0ccedc5c7888`). Both are string-based globally unique identifiers.

### Using Prisma Studio (PostgreSQL)

```bash
npm run db:studio
# Opens at http://localhost:5555
```

Prisma Studio provides a visual interface to view, edit, and manage your PostgreSQL database records with relationship navigation.

### Using MongoDB Compass (MongoDB)

If using MongoDB, you can view your data with MongoDB Compass:

1. **Open MongoDB Compass** (download from https://www.mongodb.com/products/compass if not installed)
2. **Use this connection string:**
   ```
   mongodb://todouser:todopassword@localhost:27017/tododb?authSource=admin
   ```
3. **Click "Connect"**
4. **Browse the `tododb` database** and `todos` collection

You can also connect via the MongoDB shell:

```bash
docker exec -it todo-mongo-dev mongosh -u todouser -p todopassword --authenticationDatabase admin tododb
```

---

## Technology Stack

**See [README.md](./README.md#features) for complete technology overview and architecture details.**

Quick reference:

- Backend: Node.js 18+ + Express 4.18 + TypeScript 5.3
- Databases: PostgreSQL 16 (Prisma ORM 6.19) OR MongoDB 7.0 (Mongoose ODM 8.0)
- Validation: Zod 4.1 (HTTP layer) + Mongoose schemas (MongoDB)
- Testing: Vitest 4.0 + Supertest
- Security: Helmet, CORS, Rate Limiting

---

### Manual Setup (Without Docker)

If you prefer to run services locally without Docker:

### Requirements

- Node.js 18+
- PostgreSQL 14+ OR MongoDB 6+ installed and running

### Installation Steps

**1. Install dependencies:**

```bash
npm install
```

**2. Configure environment:**

```bash
cp .env.example .env
# Edit .env with your database connection details
```

For PostgreSQL:

```env
DB_TYPE=postgres
DATABASE_URL="postgresql://todouser:todopassword@localhost:5432/tododb"
```

For MongoDB:

```env
DB_TYPE=mongodb
MONGODB_URL="mongodb://localhost:27017/tododb"
```

**3. Initialize database:**

For PostgreSQL:

```bash
npm run prisma:migrate
npm run prisma:seed
```

For MongoDB:

```bash
npm run db:seed:mongo
```

**4. Start development server:**

```bash
npm run dev
```

Your API will be available at http://localhost:4000

**Database GUI (PostgreSQL only):**

```bash
npm run db:studio:local
# Opens at http://localhost:5555
```

---

## Troubleshooting

### Container Issues

#### Containers won't start

**Problem:** Docker containers fail to start or immediately exit

**Solutions:**

```bash
# Check if ports are already in use
lsof -i :4000    # API port
lsof -i :5432    # PostgreSQL port
lsof -i :5555    # Prisma Studio port

# Stop conflicting services
docker-compose down

# Verify Docker is running
docker info

# Clean up and restart
docker-compose -f docker-compose.dev.yml down -v
docker-compose -f docker-compose.dev.yml up -d
```

#### API container exits immediately

**Problem:** `todo-api-dev` container starts then stops

**Solutions:**

```bash
# Check logs for errors
npm run docker:compose:logs:dev

# Common causes and fixes:
# 1. Missing dependencies - rebuild container
docker-compose -f docker-compose.dev.yml build --no-cache

# 2. Syntax error in code - check logs for stack trace
# 3. Port already in use - kill process on port 4000
```

#### PostgreSQL container not healthy

**Problem:** Database container shows "unhealthy" status

**Solutions:**

```bash
# Check PostgreSQL logs
docker logs postgres-dev

# Wait for initialization (first start takes 15-20 seconds)
docker ps    # Check status column

# If stuck, remove volume and restart
docker-compose -f docker-compose.dev.yml down -v
docker-compose -f docker-compose.dev.yml up -d
```

#### Volume permission errors

**Problem:** Permission denied errors in containers

**Solutions:**

```bash
# macOS/Linux: Fix ownership
sudo chown -R $USER:$USER ./node_modules ./dist

# Nuclear option: Remove all volumes and restart
docker-compose -f docker-compose.dev.yml down -v
docker volume prune -f
npm run docker:compose:dev
```

---

### Database Issues

#### "Cannot connect to database" error

**Problem:** API can't reach database server

**Solutions:**

For PostgreSQL:

```bash
# Verify PostgreSQL is running and healthy
docker ps | grep postgres

# Check DATABASE_URL format in .env
# Correct format: postgresql://todouser:todopassword@postgres-dev:5432/tododb

# Test connection manually
docker exec -it postgres-dev psql -U todouser -d tododb -c "SELECT 1;"

# If connection refused, restart database
docker restart postgres-dev
```

For MongoDB:

```bash
# Verify MongoDB is running and healthy
docker ps | grep mongo

# Check MONGODB_URL format in .env
# Correct format: mongodb://todouser:todopassword@mongo-dev:27017/tododb?authSource=admin

# Test connection manually
docker exec -it mongo-dev mongosh -u todouser -p todopassword --authenticationDatabase admin tododb --eval "db.runCommand({ ping: 1 })"

# If connection refused, restart database
docker restart mongo-dev
```

#### Migration fails with "relation already exists"

**Problem:** Migration error about existing tables

**Solutions:**

```bash
# Option 1: Reset database (development only)
npm run db:reset

# Option 2: Mark migrations as applied
docker-compose -f docker-compose.dev.yml exec todo-api-dev npm run prisma:migrate:resolve -- --applied <migration-name>

# Option 3: Drop database and start fresh
docker exec -it postgres-dev psql -U todouser -d postgres -c "DROP DATABASE tododb;"
docker exec -it postgres-dev psql -U todouser -d postgres -c "CREATE DATABASE tododb;"
npm run db:migrate
```

#### "Prisma Client not generated" error

**Problem:** Missing or outdated Prisma Client

**Solutions:**

```bash
# Regenerate Prisma Client
docker-compose -f docker-compose.dev.yml exec todo-api-dev npm run prisma:generate

# Or rebuild container
docker-compose -f docker-compose.dev.yml build --no-cache todo-api-dev
```

#### Seed script fails

**Problem:** Seed commands throw errors

**Solutions:**

For PostgreSQL:

```bash
# Check if migrations are applied
npm run db:migrate

# Check database connection
docker ps | grep postgres

# Run seed with verbose logging
docker-compose -f docker-compose.dev.yml exec todo-api-dev npm run prisma:seed -- --verbose

# If data conflicts, reset first
npm run db:reset
```

For MongoDB:

```bash
# Check database connection
docker ps | grep mongo

# Verify DB_TYPE is set to mongodb
echo $DB_TYPE

# Run seed script directly
npm run db:seed:mongo

# Check for connection errors in output
docker logs node-express-api-2026-todo-api-dev-1
```

#### Database locks or deadlocks

**Problem:** Queries hang or timeout

**Solutions:**

```bash
# Check active connections
docker exec -it postgres-dev psql -U todouser -d tododb -c "SELECT * FROM pg_stat_activity;"

# Kill long-running queries
docker exec -it postgres-dev psql -U todouser -d tododb -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle in transaction';"

# Restart database
docker restart postgres-dev
```

---

### API Issues

#### API returns 404 for all routes

**Problem:** Express routes not registered

**Solutions:**

- Check `src/app.ts` has route imports and `.use()` calls
- Verify route paths match request URLs
- Check for middleware errors preventing route registration
- Review logs: `npm run docker:compose:logs:dev`

#### CORS errors in browser

**Problem:** "Access-Control-Allow-Origin" errors

**Solutions:**

```typescript
// Update CORS configuration in src/app.ts
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  })
);
```

```bash
# Set in .env
CORS_ORIGIN=http://localhost:3000
```

#### Rate limiting blocking requests

**Problem:** "Too many requests" (429) errors

**Solutions:**

```typescript
// Adjust rate limit in src/app.ts
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Increase from 100
  message: 'Too many requests',
});
```

#### Validation errors for valid data

**Problem:** Zod validation rejecting correct input

**Solutions:**

- Check schema definitions in `src/schemas/`
- Verify request body format matches schema
- Test with Swagger UI to see validation details
- Add `.passthrough()` temporarily to debug:
  ```typescript
  z.object({ title: z.string() }).passthrough();
  ```

#### Hot reload not working

**Problem:** Code changes don't trigger restart

**Solutions:**

```bash
# Check if nodemon is watching files
docker logs node-express-api-2026-todo-api-dev-1 | grep "watching"

# Verify volume mounts in docker-compose.dev.yml
# Should have: ./src:/app/src

# Restart container
docker restart node-express-api-2026-todo-api-dev-1

# If still broken, rebuild
docker-compose -f docker-compose.dev.yml build --no-cache
```

---

### Prisma Studio Issues

#### Prisma Studio won't open (localhost:5555 unreachable)

**Problem:** Port 5555 not accessible

**Solutions:**

```bash
# Verify port mapping exists
docker ps --format "table {{.Names}}\t{{.Ports}}" | grep 5555

# Ensure Studio is running
npm run db:studio

# Check if port is bound
lsof -i :5555

# Try accessing directly
curl http://localhost:5555

# Restart with fresh mapping
docker-compose -f docker-compose.dev.yml down
docker-compose -f docker-compose.dev.yml up -d
npm run db:studio
```

#### Prisma Studio shows empty database

**Problem:** Tables exist but show no data

**Solutions:**

```bash
# Verify data exists via SQL
docker exec -it postgres-dev psql -U todouser -d tododb -c "SELECT COUNT(*) FROM \"Todo\";"

# Check if connected to correct database
# Look at DATABASE_URL in .env

# Seed database if empty
npm run db:seed

# Restart Studio
# Ctrl+C to stop, then npm run db:studio
```

#### Prisma Studio stuck loading

**Problem:** Studio UI shows loading spinner indefinitely

**Solutions:**

```bash
# Check browser console for errors
# Often caused by network issues

# Restart Prisma Studio
# Ctrl+C then npm run db:studio

# Clear browser cache and retry
# Or try incognito mode

# Check database connection
docker exec -it postgres-dev psql -U todouser -d tododb -c "SELECT 1;"
```

---

### Testing Issues

#### Tests failing with database errors

**Problem:** Test suite can't connect to database

**Solutions:**

```bash
# Ensure containers are running
npm run docker:compose:dev:bg

# Check test database configuration
# Tests should use separate test database or in-memory SQLite

# Run tests with verbose output
npm test -- --reporter=verbose

# Reset test database
NODE_ENV=test npm run db:reset
```

#### Tests pass individually but fail in suite

**Problem:** Test interference or state leakage

**Solutions:**

- Ensure tests clean up after themselves
- Check for shared state or global variables
- Use `beforeEach` to reset state
- Run tests in isolation: `npm test -- -t "specific test"`

#### Coverage reports incorrect

**Problem:** Coverage doesn't match actual test coverage

**Solutions:**

```bash
# Clear cache and regenerate
npm run test:coverage -- --coverage.clean

# Exclude irrelevant files in vitest.config.ts
coverage: {
  exclude: ['**/*.test.ts', '**/*.config.ts']
}
```

---

### GraphQL Issues

#### GraphQL endpoint returns 404

**Problem:** Cannot access `/graphql` endpoint

**Solutions:**

```bash
# Check API_TYPE environment variable
# Should be 'graphql' or 'both' (not 'rest')
docker-compose exec -T todo-api-dev printenv | grep API_TYPE

# Verify in logs that GraphQL is enabled
docker-compose logs todo-api-dev | grep "GraphQL"
# Should see: "✅ GraphQL API enabled at /graphql"

# Restart with correct API_TYPE
docker-compose down
API_TYPE=both docker-compose -f docker-compose.dev.yml up -d
```

#### Subscription connection fails

**Problem:** WebSocket connection to subscriptions fails

**Solutions:**

1. **Check WebSocket URL format:**
   - Use `ws://localhost:4000/graphql` (not `http://`)
   - In production, use `wss://` for secure WebSocket

2. **Verify server logs show WebSocket enabled:**

   ```bash
   docker-compose logs todo-api-dev | grep "WebSocket"
   # Should see: "- WebSocket endpoint: ws://localhost:4000/graphql"
   ```

3. **Test with Apollo Studio:**
   - Open https://studio.apollographql.com/sandbox/explorer
   - Connect to `http://localhost:4000/graphql`
   - Try a subscription query from GRAPHQL_EXAMPLES.md

#### GraphQL query validation errors

**Problem:** "Cannot query field X on type Y" error

**Solutions:**

- Check field name spelling matches schema
- Verify schema is loaded correctly (restart server)
- Review schema definition in `/src/graphql/schema.ts`
- Use Apollo Studio's schema explorer to see available fields

#### DataLoader not batching queries

**Problem:** See individual database queries instead of batched queries

**This is expected behavior:**

- DataLoader batches queries within a 10ms window per GraphQL operation
- Separate GraphQL requests are separate operations (not batched together)
- DataLoader primarily prevents N+1 problems within a single query

**To verify batching works:**

1. Query a list of todos
2. Check logs for batch loading behavior
3. Should see one database query for multiple todo fetches within the same operation

---

### TypeScript Issues

#### Type errors after Prisma schema change

**Problem:** TypeScript complains about Prisma types

**Solutions:**

```bash
# Regenerate Prisma Client
docker-compose -f docker-compose.dev.yml exec todo-api-dev npm run prisma:generate

# Restart TypeScript server in VS Code
# Cmd+Shift+P → "TypeScript: Restart TS Server"

# Check types manually
npm run type-check
```

#### Module not found errors

**Problem:** Cannot find module or type definitions

**Solutions:**

```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# In container
docker-compose -f docker-compose.dev.yml down
docker-compose -f docker-compose.dev.yml build --no-cache
docker-compose -f docker-compose.dev.yml up -d
```

---

### Performance Issues

#### API responses are slow

**Problem:** Endpoints take several seconds to respond

**Solutions:**

- Check database query performance in Prisma Studio
- Add indexes to frequently queried fields
- Use `.select()` to fetch only needed fields
- Enable query logging:
  ```typescript
  const prisma = new PrismaClient({ log: ['query'] });
  ```
- Check for N+1 query problems

#### High memory usage

**Problem:** Node process consuming excessive memory

**Solutions:**

```bash
# Check container stats
docker stats

# Restart API container
docker restart node-express-api-2026-todo-api-dev-1

# Increase memory limit in docker-compose.dev.yml
deploy:
  resources:
    limits:
      memory: 1G
```

#### Docker consuming too much disk space

**Problem:** Docker images and volumes filling disk

**Solutions:**

```bash
# Clean up unused resources
docker system prune -a --volumes

# Remove specific volumes
docker volume ls
docker volume rm <volume-name>

# Check disk usage
docker system df
```

---

### Development Workflow Issues

#### Changes not reflecting in API

**Problem:** Code changes not visible in running app

**Solutions:**

```bash
# Verify hot reload is working
docker logs node-express-api-2026-todo-api-dev-1 | tail -20

# Check volume mounts
docker inspect node-express-api-2026-todo-api-dev-1 | grep -A 10 Mounts

# Manual restart
docker restart node-express-api-2026-todo-api-dev-1

# Rebuild if needed
docker-compose -f docker-compose.dev.yml build todo-api-dev
```

#### Environment variables not loading

**Problem:** process.env.VARIABLE is undefined

**Solutions:**

- Verify `.env` file exists and has correct format
- No quotes needed: `PORT=4000` not `PORT="4000"`
- Restart containers after .env changes
- Check docker-compose.dev.yml has `env_file: .env`
- Use dotenv-cli: `dotenv -e .env -- node script.js`

#### Git conflicts in package-lock.json

**Problem:** Merge conflicts in lock file

**Solutions:**

```bash
# Regenerate lock file
rm package-lock.json
npm install

# Or accept one version and reinstall
git checkout --theirs package-lock.json
npm install
```

---

### Common Error Messages

#### "Error: listen EADDRINUSE: address already in use"

**Cause:** Port 4000 already occupied

**Solution:**

```bash
# Find and kill process
lsof -ti:4000 | xargs kill -9

# Or use different port in .env
PORT=4001
```

#### "Error: connect ECONNREFUSED 127.0.0.1:5432"

**Cause:** PostgreSQL not running or wrong host

**Solution:**

```bash
# In Docker, use service name, not localhost
DATABASE_URL="postgresql://todouser:todopassword@postgres-dev:5432/tododb"

# For local PostgreSQL, use localhost
DATABASE_URL="postgresql://todouser:todopassword@localhost:5432/tododb"
```

#### "Error: P1001: Can't reach database server"

**Cause:** Database not accessible

**Solution:**

```bash
# Wait for database to be ready
docker ps    # Check postgres-dev is healthy

# Test connection
docker exec -it postgres-dev psql -U todouser -d tododb -c "SELECT 1;"

# Check network
docker network inspect node-express-api-2026_default
```

#### "Error: Migration engine failed to start"

**Cause:** Prisma migration issues

**Solution:**

```bash
# Clear migration lock
docker exec -it postgres-dev psql -U todouser -d tododb -c "DELETE FROM \"_prisma_migrations\" WHERE \"migration_name\" = 'migration_lock';"

# Regenerate and retry
npm run prisma:generate
npm run db:migrate
```

---

## Getting Help

If you're still experiencing issues:

1. **Check logs thoroughly:**

   ```bash
   npm run docker:compose:logs:dev | grep -i error
   ```

2. **Verify system requirements:**
   - Docker Desktop 4.0+
   - Node.js 18+
   - At least 4GB available RAM
   - 10GB free disk space

3. **Try the nuclear option** (development only):

   ```bash
   # Stop everything and clean up
   docker-compose -f docker-compose.dev.yml down -v
   docker system prune -a --volumes -f

   # Remove node_modules
   rm -rf node_modules package-lock.json

   # Fresh start
   npm install
   npm run docker:compose:dev
   npm run db:migrate
   npm run db:seed
   ```

4. **Search for similar issues:**
   - Check GitHub Issues in the project repository
   - Search Prisma documentation: https://www.prisma.io/docs
   - Check Docker documentation: https://docs.docker.com

5. **Report the issue:**
   - Include full error messages
   - Share relevant logs
   - Describe steps to reproduce
   - Mention your OS and Docker version

---

## Next Steps

**1. Explore the API**

- Open http://localhost:4000/api-docs
- Test endpoints using the interactive Swagger interface
- Review the OpenAPI specification

**2. Inspect the Database**

For PostgreSQL:

- Run `npm run db:studio`
- Browse the 20 sample todos at http://localhost:5555
- Explore table relationships and data types

For MongoDB:

- Open MongoDB Compass
- Connect with: `mongodb://todouser:todopassword@localhost:27017/tododb?authSource=admin`
- Browse the `todos` collection
- View and edit documents directly

**3. Run the Test Suite**

- Execute `npm test` to verify functionality
- Review test coverage with `npm run test:coverage`
- Check `src/__tests__` for test examples

**4. Customize Your API**

- Modify `prisma/schema.prisma` to add/change models
- Run `npm run db:migrate` to apply schema changes
- Create new routes in `src/routes/`
- Add validation schemas in `src/schemas/`
- Update tests in `src/__tests__/`

**5. Learn the Architecture**

- See [README.md](./README.md#project-structure) for project structure
- Review [README.md](./README.md#database-schema) for schema design
- Check [README.md](./README.md#security-features) for security details

---

## Best Practices

**Development Workflow:**

- Keep containers running in background mode for faster iterations
- Use Swagger UI for quick endpoint testing instead of writing curl commands
- Run Prisma Studio to verify database changes visually
- Check logs regularly with `npm run docker:compose:logs:dev`
- Run tests before committing changes

**Database Management:**

- Always create migrations for schema changes: `npm run prisma:migrate:dev`
- Never edit migration files manually after they're created
- Use `db:reset` freely in development to start with clean state
- Keep seed data representative of production scenarios

**Code Quality:**

- Run `npm run type-check` to catch TypeScript errors
- Use `npm run lint` to identify code issues
- Format code with `npm run format` before commits
- Write tests for new features and bug fixes

---

## Common Workflows

### Adding a New API Endpoint

1. **Define the schema** in `src/schemas/`:

   ```typescript
   export const createItemSchema = z.object({
     body: z.object({ name: z.string() }),
   });
   ```

2. **Create the route** in `src/routes/`:

   ```typescript
   router.post('/items', validate(createItemSchema), async (req, res) => {
     // implementation
   });
   ```

3. **Add JSDoc** for Swagger documentation
4. **Write tests** in `src/__tests__/`
5. **Test manually** via Swagger UI

### Modifying the Database Schema

**For PostgreSQL:**

1. **Edit** `prisma/schema.prisma`
2. **Create migration:** `npm run db:migrate`
3. **Update seed data** if needed in `prisma/seed.ts`
4. **Update Zod schemas** in `src/schemas/`
5. **Regenerate types:** Happens automatically during migration

**For MongoDB:**

1. **Edit** Mongoose schema in `src/models/mongoose/`
2. **Update repository** implementation if field types changed
3. **Update seed data** if needed in `scripts/seed-mongodb.ts`
4. **Update Zod schemas** in `src/schemas/`
5. **Restart server** to apply changes (no migration needed)

### Debugging Issues

**Check logs:**

```bash
npm run docker:compose:logs:dev     # All container logs
docker logs node-express-api-2026-todo-api-dev-1  # API logs only
```

**Inspect database:**

```bash
npm run db:studio                   # Visual inspection
docker exec -it postgres-dev psql -U todouser -d tododb  # SQL console
```

**Check container health:**

```bash
docker ps                           # Status overview
docker inspect <container-id>       # Detailed info
```

---

docker inspect <container-id> # Detailed info

````

---

## Advanced Topics

### Running Tests Against Real Database

Tests use in-memory SQLite by default. To test against PostgreSQL:

```bash
# Ensure containers are running
npm run docker:compose:dev:bg

# Run tests (uses DATABASE_URL from .env)
npm test
````

### Custom Environment Variables

Add to `.env`:

```env
CUSTOM_VAR=value
```

Access in code:

```typescript
const customVar = process.env.CUSTOM_VAR;
```

### Using the Node Debugger

Port 9229 is exposed for debugging:

1. Set breakpoints in VS Code
2. Run "Attach to Node" debug configuration
3. Debugger connects to running container

---

## Performance Tips

- **Database Queries:** Use Prisma's `include` and `select` to minimize data transfer
- **Pagination:** Always paginate large datasets (default: 10 items)
- **Indexing:** Add indexes for frequently queried fields in `schema.prisma`
- **Compression:** Enabled by default for responses > 1KB
- **Rate Limiting:** Adjust limits in `src/app.ts` based on your needs

---

- **Rate Limiting:** Adjust limits in `src/app.ts` based on your needs

---

## Quick Reference

### Port Configuration

| Service       | Port  | Access                |
| ------------- | ----- | --------------------- |
| API Server    | 4000  | http://localhost:4000 |
| PostgreSQL    | 5432  | localhost:5432        |
| MongoDB       | 27017 | localhost:27017       |
| Prisma Studio | 5555  | http://localhost:5555 |
| Node Debugger | 9229  | Debug attach          |

### Key Environment Variables

**PostgreSQL Configuration:**

```bash
DB_TYPE="postgres"
DATABASE_URL="postgresql://todouser:todopassword@localhost:5432/tododb"
NODE_ENV="development"
PORT=4000
CORS_ORIGIN="http://localhost:3000"
```

**MongoDB Configuration:**

```bash
DB_TYPE="mongodb"
MONGODB_URL="mongodb://todouser:todopassword@localhost:27017/tododb?authSource=admin"
NODE_ENV="development"
PORT=4000
CORS_ORIGIN="http://localhost:3000"
```

See `.env.example` for all available options.

### Future Enhancements Available

- **Husky + lint-staged** - Pre-commit hooks
- **BullMQ** - Background job processing
- **Sentry** - Error tracking
- **Winston** - Advanced logging (basic setup included)

---

## Additional Resources

- **[README.md](./README.md)** - Project overview, architecture, and technical reference
- **[Prisma Docs](https://www.prisma.io/docs)** - ORM documentation
- **[Zod Docs](https://zod.dev)** - Validation schema reference
- **[Swagger UI](http://localhost:4000/api-docs)** - Interactive API testing (when running)

---

**Happy coding!** For questions or issues, check the troubleshooting section above or review the README.
