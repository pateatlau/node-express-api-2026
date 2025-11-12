#!/bin/sh
set -e

echo "🚀 Starting backend development server..."

# Wait for MongoDB to be ready (using nc/netcat to check if port is open)
echo "⏳ Waiting for MongoDB to be ready..."
until nc -z mongo-dev 27017 > /dev/null 2>&1; do
  echo "MongoDB is unavailable - sleeping"
  sleep 2
done

echo "✅ MongoDB is ready!"

# Initialize database (seed only if empty)
echo "🌱 Initializing database..."
npm run mongo:init

# Start the development server
echo "🎬 Starting development server with hot reload..."
exec npm run dev:docker
