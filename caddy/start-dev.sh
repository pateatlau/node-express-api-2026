#!/bin/bash

# =================================================================
# Caddy Load Balanced Development Environment - Start Script
# =================================================================
# This script starts the entire Caddy + Backend + Database stack
# =================================================================

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=================================================${NC}"
echo -e "${BLUE}  Caddy Load Balanced Environment - Start${NC}"
echo -e "${BLUE}=================================================${NC}"
echo ""

# Check if .env.caddy exists
if [ ! -f .env.caddy ]; then
    echo -e "${YELLOW}⚠️  .env.caddy not found!${NC}"
    echo -e "${YELLOW}   Creating from .env.caddy.example...${NC}"
    cp .env.caddy.example .env.caddy
    echo -e "${GREEN}✅ Created .env.caddy${NC}"
    echo -e "${YELLOW}⚠️  IMPORTANT: Update .env.caddy with your database credentials!${NC}"
    echo ""
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running!${NC}"
    echo -e "${YELLOW}   Please start Docker Desktop and try again.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Docker is running${NC}"
echo ""

# Check if caddy directories exist
if [ ! -d "caddy/data" ] || [ ! -d "caddy/logs" ]; then
    echo -e "${YELLOW}⚠️  Creating Caddy directories...${NC}"
    mkdir -p caddy/data caddy/logs
    echo -e "${GREEN}✅ Created caddy/data and caddy/logs${NC}"
    echo ""
fi

# Pull latest images (optional, comment out if not needed)
echo -e "${BLUE}📦 Pulling latest Docker images...${NC}"
docker-compose -f docker-compose.caddy.yml pull

echo ""
echo -e "${BLUE}🚀 Starting services...${NC}"
echo -e "${YELLOW}   This may take a few minutes on first run (building images)${NC}"
echo ""

# Start services
docker-compose -f docker-compose.caddy.yml up -d

# Wait for services to be healthy
echo ""
echo -e "${BLUE}⏳ Waiting for services to be healthy...${NC}"
sleep 5

# Check service health
echo ""
echo -e "${BLUE}📊 Service Status:${NC}"
docker-compose -f docker-compose.caddy.yml ps

echo ""
echo -e "${GREEN}=================================================${NC}"
echo -e "${GREEN}  ✅ Services Started Successfully!${NC}"
echo -e "${GREEN}=================================================${NC}"
echo ""
echo -e "${BLUE}🌐 Access Points:${NC}"
echo -e "   • Caddy Proxy:      ${GREEN}http://localhost:8080${NC}"
echo -e "   • Health Check:     ${GREEN}http://localhost:8080/health${NC}"
echo -e "   • Caddy Health:     ${GREEN}http://localhost:8080/caddy-health${NC}"
echo -e "   • REST API:         ${GREEN}http://localhost:8080/api/*${NC}"
echo -e "   • GraphQL:          ${GREEN}http://localhost:8080/graphql${NC}"
echo -e "   • API Docs:         ${GREEN}http://localhost:8080/api-docs${NC}"
echo -e "   • WebSocket:        ${GREEN}ws://localhost:8080/socket.io${NC}"
echo -e "   • Caddy Admin API:  ${GREEN}http://localhost:2019${NC}"
echo ""
echo -e "${BLUE}📦 Backend Instances:${NC}"
echo -e "   • backend-1: 4001 (internal only)"
echo -e "   • backend-2: 4002 (internal only)"
echo -e "   • backend-3: 4003 (internal only)"
echo ""
echo -e "${BLUE}💾 Databases:${NC}"
echo -e "   • PostgreSQL: 5432 (internal only)"
echo -e "   • MongoDB:    27017 (internal only)"
echo ""
echo -e "${BLUE}📝 Useful Commands:${NC}"
echo -e "   • View logs:        ${YELLOW}./caddy/stop-dev.sh logs${NC}"
echo -e "   • Stop services:    ${YELLOW}./caddy/stop-dev.sh${NC}"
echo -e "   • Restart services: ${YELLOW}./caddy/stop-dev.sh && ./caddy/start-dev.sh${NC}"
echo -e "   • Check health:     ${YELLOW}curl http://localhost:8080/health${NC}"
echo ""
echo -e "${YELLOW}⚠️  Note: Backend instances are only accessible through Caddy proxy${NC}"
echo -e "${YELLOW}   All requests should go to http://localhost:8080${NC}"
echo ""
