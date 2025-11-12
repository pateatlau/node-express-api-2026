# Database Docker Commands

This guide shows how to run MongoDB and PostgreSQL databases using Docker for local development.

## Quick Start

### Option 1: Using Docker Compose (Recommended)

Start all services (MongoDB, PostgreSQL, and the API):

```bash
npm run docker:compose:dev
```

Run in background:

```bash
npm run docker:compose:dev:bg
```

Stop all services:

```bash
npm run docker:compose:down
```

### Option 2: Run Only MongoDB

#### Start MongoDB

```bash
npm run mongo:start
```

This will:

- Start the existing `todo-mongo-dev` container, or
- Create a new container if it doesn't exist
- MongoDB will be accessible on `localhost:27017`

#### Stop MongoDB

```bash
npm run mongo:stop
```

#### Restart MongoDB

```bash
npm run mongo:restart
```

#### View MongoDB Logs

```bash
npm run mongo:logs
```

#### Access MongoDB Shell

```bash
npm run mongo:shell
```

This opens an interactive MongoDB shell connected to your database.

#### Remove MongoDB Container

```bash
npm run mongo:remove
```

⚠️ This will delete the container (but not the data volume).

### Option 3: Run Only PostgreSQL

#### Start PostgreSQL

```bash
npm run postgres:start
```

PostgreSQL will be accessible on `localhost:5432`

#### Stop PostgreSQL

```bash
npm run postgres:stop
```

#### Restart PostgreSQL

```bash
npm run postgres:restart
```

#### View PostgreSQL Logs

```bash
npm run postgres:logs
```

#### Access PostgreSQL Shell

```bash
npm run postgres:psql
```

#### Remove PostgreSQL Container

```bash
npm run postgres:remove
```

## Manual Docker Commands

If you prefer to run Docker commands directly:

### MongoDB

```bash
# Start MongoDB
docker run -d \
  --name todo-mongo-dev \
  -p 27017:27017 \
  -e MONGO_INITDB_ROOT_USERNAME=todouser \
  -e MONGO_INITDB_ROOT_PASSWORD=todopassword \
  -e MONGO_INITDB_DATABASE=tododb \
  mongo:7.0

# Stop
docker stop todo-mongo-dev

# Start existing container
docker start todo-mongo-dev

# View logs
docker logs -f todo-mongo-dev

# Access shell
docker exec -it todo-mongo-dev mongosh \
  -u todouser \
  -p todopassword \
  --authenticationDatabase admin \
  tododb

# Remove
docker rm todo-mongo-dev
```

### PostgreSQL

```bash
# Start PostgreSQL
docker run -d \
  --name todo-postgres-dev \
  -p 5432:5432 \
  -e POSTGRES_USER=todouser \
  -e POSTGRES_PASSWORD=todopassword \
  -e POSTGRES_DB=tododb \
  postgres:16-alpine

# Stop
docker stop todo-postgres-dev

# Start existing container
docker start todo-postgres-dev

# View logs
docker logs -f todo-postgres-dev

# Access psql
docker exec -it todo-postgres-dev \
  psql -U todouser -d tododb

# Remove
docker rm todo-postgres-dev
```

## Database Configuration

### MongoDB Connection String

```
mongodb://todouser:todopassword@localhost:27017/tododb?authSource=admin
```

### PostgreSQL Connection String

```
postgresql://todouser:todopassword@localhost:5432/tododb?schema=public
```

## Environment Variables

Update your `.env` file:

```properties
# For MongoDB
DB_TYPE=mongodb
MONGODB_URL="mongodb://todouser:todopassword@localhost:27017/tododb?authSource=admin"

# For PostgreSQL
DB_TYPE=postgres
DATABASE_URL="postgresql://todouser:todopassword@localhost:5432/tododb?schema=public"
```

## Common Workflows

### Development with MongoDB

```bash
# 1. Start MongoDB
npm run mongo:start

# 2. Start the backend server
npm run dev

# 3. (Optional) Seed the database
npm run mongo:seed

# 4. (Optional) View logs
npm run mongo:logs
```

### Switch Between Databases

```bash
# Stop current database
npm run mongo:stop

# Start the other database
npm run postgres:start

# Update .env file to change DB_TYPE
# Restart your backend server
```

### Full Stack Development

```bash
# Terminal 1: Start MongoDB
npm run mongo:start

# Terminal 2: Start Backend
cd /Users/patea/2026/projects/node-express-api-2026
npm run dev

# Terminal 3: Start Frontend
cd /Users/patea/2026/projects/react-stack-2026
npm run dev
```

## Troubleshooting

### Port Already in Use

If you see "port already allocated":

```bash
# Find process using the port
lsof -ti:27017  # for MongoDB
lsof -ti:5432   # for PostgreSQL

# Kill the process
kill -9 <PID>

# Or stop the container
npm run mongo:stop
```

### Container Already Exists

If you see "container name already in use":

```bash
# Remove the old container
npm run mongo:remove

# Then start fresh
npm run mongo:start
```

### Connection Refused

Make sure:

1. Container is running: `docker ps | grep mongo`
2. Port is correct in `.env`: `27017` for MongoDB, `5432` for PostgreSQL
3. Hostname is `localhost` (not `mongo-dev` for local development)

### Reset Database

```bash
# For MongoDB - stop and remove container, then start fresh
npm run mongo:remove
npm run mongo:start
npm run mongo:seed

# For PostgreSQL - use Prisma migrations
npm run db:reset
```

## Database GUI Tools

### MongoDB

- **MongoDB Compass**: https://www.mongodb.com/products/compass
  - Connection string: `mongodb://todouser:todopassword@localhost:27017/tododb?authSource=admin`

### PostgreSQL

- **pgAdmin**: https://www.pgadmin.org/
- **DBeaver**: https://dbeaver.io/
  - Host: `localhost`
  - Port: `5432`
  - Database: `tododb`
  - Username: `todouser`
  - Password: `todopassword`

## Data Persistence

Docker volumes ensure data persists between container restarts. To completely wipe data:

```bash
# List volumes
docker volume ls

# Remove MongoDB volume
docker volume rm <mongo_volume_name>

# Remove PostgreSQL volume
docker volume rm <postgres_volume_name>
```
