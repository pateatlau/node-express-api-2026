#!/bin/bash

# =================================================================
# Caddy Load Balanced Development Environment - Stop Script
# =================================================================
# This script stops the entire Caddy + Backend + Database stack
# =================================================================

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if first argument is "logs"
if [ "$1" = "logs" ]; then
    echo -e "${BLUE}=================================================${NC}"
    echo -e "${BLUE}  Viewing Service Logs${NC}"
    echo -e "${BLUE}=================================================${NC}"
    echo ""
    echo -e "${YELLOW}Press Ctrl+C to exit${NC}"
    echo ""
    docker-compose -f docker-compose.caddy.yml logs -f
    exit 0
fi

echo -e "${BLUE}=================================================${NC}"
echo -e "${BLUE}  Caddy Load Balanced Environment - Stop${NC}"
echo -e "${BLUE}=================================================${NC}"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running!${NC}"
    echo -e "${YELLOW}   Cannot stop services.${NC}"
    exit 1
fi

# Check if services are running
if ! docker-compose -f docker-compose.caddy.yml ps -q | grep -q .; then
    echo -e "${YELLOW}⚠️  No services are currently running${NC}"
    exit 0
fi

echo -e "${BLUE}🛑 Stopping services...${NC}"
echo ""

# Stop and remove containers
docker-compose -f docker-compose.caddy.yml down

echo ""
echo -e "${GREEN}=================================================${NC}"
echo -e "${GREEN}  ✅ Services Stopped Successfully!${NC}"
echo -e "${GREEN}=================================================${NC}"
echo ""
echo -e "${BLUE}📝 What was stopped:${NC}"
echo -e "   • Caddy reverse proxy"
echo -e "   • 3 backend instances (backend-1, backend-2, backend-3)"
echo -e "   • PostgreSQL database"
echo -e "   • MongoDB database"
echo ""
echo -e "${YELLOW}📦 Data preserved in volumes:${NC}"
echo -e "   • caddy-postgres-data (PostgreSQL data)"
echo -e "   • caddy-mongodb-data (MongoDB data)"
echo -e "   • caddy/data (Caddy certificates and cache)"
echo -e "   • caddy/logs (Caddy logs)"
echo ""
echo -e "${BLUE}📝 Useful Commands:${NC}"
echo -e "   • Start services:      ${YELLOW}./caddy/start-dev.sh${NC}"
echo -e "   • Remove volumes:      ${YELLOW}docker-compose -f docker-compose.caddy.yml down -v${NC}"
echo -e "   • View stopped status: ${YELLOW}docker-compose -f docker-compose.caddy.yml ps -a${NC}"
echo ""
echo -e "${YELLOW}⚠️  Note: Database data is preserved. To completely reset, run:${NC}"
echo -e "   ${RED}docker-compose -f docker-compose.caddy.yml down -v${NC}"
echo ""
