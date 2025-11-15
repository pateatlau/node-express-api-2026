#!/bin/bash

# Auth Service Quick Start Script
set -e

echo "🚀 Starting Auth Service Setup..."

# Navigate to service directory
cd "$(dirname "$0")"

echo "📦 Installing dependencies..."
npm install

echo "🗄️  Generating Prisma client..."
npm run prisma:generate

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Ensure PostgreSQL is running (postgres-auth on port 5433)"
echo "2. Run migrations: npm run prisma:migrate"
echo "3. Start service: npm run dev"
echo ""
echo "Or use Docker:"
echo "  docker-compose up -d"
