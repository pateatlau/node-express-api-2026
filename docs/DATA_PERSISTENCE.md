# MongoDB Data Persistence Guide

## Overview

The backend Docker setup now includes **persistent MongoDB storage** with **intelligent database initialization**. This means:

1. ✅ **Data persists** when containers are stopped and restarted
2. ✅ **Smart seeding** only happens when the database is empty
3. ✅ **No data loss** during development workflow

## How It Works

### 1. Data Persistence

MongoDB data is stored in a Docker named volume called `mongo_data`:

```yaml
# docker-compose.dev.yml
volumes:
  mongo_data:
  postgres_data:
```

This volume exists independently of container lifecycle:

- **Stopping containers**: Data remains in volume
- **Removing containers**: Data remains in volume
- **Rebuilding images**: Data remains in volume

Data is only deleted when you explicitly remove the volume.

### 2. Smart Initialization

The backend container uses a startup script (`scripts/docker-entrypoint.sh`) that:

1. **Waits for MongoDB** to be ready (checks if port 27017 is open)
2. **Checks database** for existing todos using `init-mongodb.ts`
3. **Seeds data** only if database is empty (0 todos)
4. **Starts dev server** with hot reload

### Key Scripts

#### `scripts/init-mongodb.ts` (Smart Seeding)

```typescript
// Checks if database has data before seeding
const count = await collection.countDocuments();
if (count > 0) {
  console.log(`ℹ️  Database already has ${count} todo(s), skipping seed`);
  return;
}
// Only seeds if count === 0
```

#### `scripts/seed-mongodb.ts` (Force Reseed)

```typescript
// Always clears and reseeds (for manual use)
await collection.deleteMany({});
await collection.insertMany(todos);
```

#### `scripts/docker-entrypoint.sh` (Startup Script)

```bash
#!/bin/sh
# Wait for MongoDB
until nc -z mongo-dev 27017; do
  echo "MongoDB is unavailable - sleeping"
  sleep 2
done

# Initialize database (smart seeding)
npm run mongo:init

# Start dev server
exec npm run dev:docker
```

## Common Workflows

### Start Services with Persistent Data

```bash
cd /Users/patea/2026/projects/node-express-api-2026
docker compose -f docker-compose.dev.yml up -d
```

**First run**: Seeds 20 todos  
**Subsequent runs**: Detects existing data, skips seeding

### Stop Services (Data Persists)

```bash
docker compose -f docker-compose.dev.yml down
```

Data remains in `mongo_data` volume.

### Restart Services (Data Persists)

```bash
docker compose -f docker-compose.dev.yml restart
```

or

```bash
docker compose -f docker-compose.dev.yml down
docker compose -f docker-compose.dev.yml up -d
```

Both commands preserve data.

### Force Fresh Database (Clear All Data)

```bash
# Stop services
docker compose -f docker-compose.dev.yml down

# Remove the volume
docker volume rm node-express-api-2026_mongo_data

# Start services (will seed fresh data)
docker compose -f docker-compose.dev.yml up -d
```

### Manual Reseed (Replace Existing Data)

```bash
# Run seed script manually (clears and reseeds)
npm run mongo:seed
```

Or from outside container:

```bash
docker exec node-express-api-2026-todo-api-dev-1 npm run mongo:seed
```

## Verification

### Check Initialization Logs

```bash
docker logs node-express-api-2026-todo-api-dev-1 2>&1 | grep -i "database"
```

**Expected output** (existing data):

```
🌱 Initializing database...
✅ Connected to MongoDB
ℹ️  Database already has 20 todo(s), skipping seed
```

**Expected output** (empty database):

```
🌱 Initializing database...
✅ Connected to MongoDB
📊 Generating 20 sample todos...
✅ Successfully seeded 20 todos
```

### Verify API Data

```bash
curl http://localhost:4000/api/todos?page=1&limit=5
```

Should return 20 total todos.

### Check Volume Status

```bash
docker volume ls | grep mongo_data
```

Should show: `node-express-api-2026_mongo_data`

```bash
docker volume inspect node-express-api-2026_mongo_data
```

Shows volume details including mount point.

## Troubleshooting

### Issue: Data not persisting

**Check if volume is mounted:**

```bash
docker inspect node-express-api-2026-todo-api-dev-1 | grep mongo_data
```

**Verify volume exists:**

```bash
docker volume ls
```

### Issue: Database keeps reseeding

**Check logs for initialization message:**

```bash
docker logs node-express-api-2026-todo-api-dev-1 | grep "Database already has"
```

If you don't see this message, the `init-mongodb.ts` script may not be detecting existing data.

**Verify data in MongoDB:**

```bash
docker exec -it todo-mongo-dev mongosh -u todouser -p todopassword --authenticationDatabase admin
use tododb
db.todos.countDocuments()
```

### Issue: Container won't start

**Check entrypoint script execution:**

```bash
docker logs node-express-api-2026-todo-api-dev-1
```

Look for:

- `🚀 Starting backend development server...`
- `⏳ Waiting for MongoDB to be ready...`
- `✅ MongoDB is ready!`

### Issue: MongoDB connection timeout

**Ensure MongoDB container is healthy:**

```bash
docker ps | grep mongo
```

Should show `(healthy)` status.

**Check MongoDB logs:**

```bash
docker logs todo-mongo-dev
```

## Available NPM Scripts

```json
{
  "mongo:init": "dotenv -e .env -- tsx scripts/init-mongodb.ts",
  "mongo:seed": "dotenv -e .env -- tsx scripts/seed-mongodb.ts",
  "mongo:start": "docker run -d --name todo-mongo-dev ...",
  "mongo:stop": "docker stop todo-mongo-dev",
  "mongo:restart": "docker restart todo-mongo-dev",
  "mongo:logs": "docker logs -f todo-mongo-dev",
  "mongo:shell": "docker exec -it todo-mongo-dev mongosh ...",
  "mongo:remove": "docker rm -f todo-mongo-dev"
}
```

## Architecture

```
┌─────────────────────────────────────────┐
│ Docker Host                             │
│                                         │
│  ┌──────────────────┐                  │
│  │ Backend Container│                  │
│  │                  │                  │
│  │  1. Start        │                  │
│  │  2. Wait for     │                  │
│  │     MongoDB      │                  │
│  │  3. Check DB     │◄─────────┐      │
│  │  4. Seed if      │          │      │
│  │     empty        │          │      │
│  │  5. Start server │          │      │
│  └────────┬─────────┘          │      │
│           │                    │      │
│           │                    │      │
│  ┌────────▼─────────┐   ┌──────▼────┐ │
│  │ MongoDB Container│   │ mongo_data│ │
│  │                  │   │  Volume   │ │
│  │  Port: 27017     │───│           │ │
│  │  Credentials     │   │ Persists  │ │
│  │  Health checks   │   │ Data      │ │
│  └──────────────────┘   └───────────┘ │
│                                         │
└─────────────────────────────────────────┘
```

## Benefits

1. **Development Continuity**: Work on same dataset across sessions
2. **No Manual Seeding**: Automatic initialization on first run
3. **No Data Loss**: Accidentally stopping containers won't lose work
4. **Clean Slate Available**: Easy to reset when needed
5. **Production-Like**: Mimics real database persistence behavior

## Related Documentation

- [DATABASE_DOCKER.md](./DATABASE_DOCKER.md) - MongoDB & PostgreSQL Docker management
- [DOCKER_DEV_SETUP.md](../DOCKER_DEV_SETUP.md) - Full Docker development guide
- [README.md](../README.md) - Project overview and setup

## Summary

Your MongoDB data now persists across Docker restarts, and the database only seeds when empty. This provides a production-like development experience while maintaining the convenience of Docker containerization.

**Key Messages to Look For:**

✅ **Data Persists**: `ℹ️  Database already has 20 todo(s), skipping seed`  
✅ **Fresh Seed**: `✅ Successfully seeded 20 todos`  
✅ **Container Ready**: `Server started successfully`
