#!/bin/bash

echo "=== Testing User Profile Service Search Functionality ==="
echo ""

# Kill any existing service
pkill -9 -f "tsx watch" 2>/dev/null || true
sleep 2

# Start service in background
cd /Users/patea/2026/projects/node-express-api-2026/services/user-profile-service
npm run dev > /tmp/profile-test.log 2>&1 &
SERVICE_PID=$!

echo "Started service with PID: $SERVICE_PID"
echo "Waiting for service to start..."
sleep 5

# Test health
echo ""
echo "Test 1: Health Check"
curl -s --max-time 3 http://localhost:4002/health | jq '.' || echo "FAILED - timeout or error"

# Test search
echo ""
echo "Test 2: Search for 'engineer'"
curl -s --max-time 3 'http://localhost:4002/profile/search?q=engineer&limit=5' | jq '.' || echo "FAILED - timeout or error"

echo ""
echo "=== Test Complete ==="
echo "Service logs in /tmp/profile-test.log"
echo "Kill service with: kill $SERVICE_PID"
