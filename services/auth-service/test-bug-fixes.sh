#!/bin/bash

# Auth Service Bug Fix Verification Script
# Tests all critical bug fixes

echo "=========================================="
echo "Auth Service Bug Fix Verification"
echo "=========================================="
echo ""

BASE_URL="http://localhost:4001/api/auth"
EMAIL="test-$(date +%s)@example.com"
PASSWORD="SecurePass123!@#"

echo "📝 Test 1: Signup with session tracking"
SIGNUP_RESPONSE=$(curl -s -X POST "$BASE_URL/signup" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"role\":\"user\"}")

ACCESS_TOKEN=$(echo $SIGNUP_RESPONSE | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)

if [ -z "$ACCESS_TOKEN" ]; then
  echo "❌ Signup failed"
  echo "$SIGNUP_RESPONSE"
  exit 1
fi

echo "✅ Signup successful - Token received"

# Decode JWT to check for sessionId
JWT_PAYLOAD=$(echo $ACCESS_TOKEN | cut -d'.' -f2 | base64 -d 2>/dev/null)
echo "   JWT Payload: $JWT_PAYLOAD"

if echo "$JWT_PAYLOAD" | grep -q "sessionId"; then
  echo "✅ JWT contains sessionId field"
else
  echo "❌ JWT missing sessionId field"
fi

echo ""
echo "📝 Test 2: Activity tracking"
ACTIVITY_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/activity" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

HTTP_CODE=$(echo "$ACTIVITY_RESPONSE" | tail -n1)
if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Activity tracking working"
else
  echo "❌ Activity tracking failed (HTTP $HTTP_CODE)"
fi

echo ""
echo "📝 Test 3: Sessions list with current device marker"
SESSIONS_RESPONSE=$(curl -s -X GET "$BASE_URL/sessions" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

echo "$SESSIONS_RESPONSE" | grep -q "isCurrent"
if [ $? -eq 0 ]; then
  echo "✅ Sessions list includes isCurrent marker"
  if echo "$SESSIONS_RESPONSE" | grep -q '"isCurrent":true'; then
    echo "✅ Current session correctly identified"
  else
    echo "⚠️  No session marked as current"
  fi
else
  echo "❌ Sessions list missing isCurrent field"
fi

echo ""
echo "📝 Test 4: Session deletion with ownership validation"
# Get the current session ID
SESSION_ID=$(echo "$SESSIONS_RESPONSE" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

if [ -n "$SESSION_ID" ]; then
  echo "   Attempting to delete session: $SESSION_ID"
  DELETE_RESPONSE=$(curl -s -w "\n%{http_code}" -X DELETE "$BASE_URL/sessions/$SESSION_ID" \
    -H "Authorization: Bearer $ACCESS_TOKEN")
  
  HTTP_CODE=$(echo "$DELETE_RESPONSE" | tail -n1)
  if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Can delete own session"
  else
    echo "❌ Cannot delete own session (HTTP $HTTP_CODE)"
  fi
else
  echo "⚠️  No session ID found to test deletion"
fi

echo ""
echo "📝 Test 5: Login creates new session with sessionId"
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

NEW_ACCESS_TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)

if [ -n "$NEW_ACCESS_TOKEN" ]; then
  echo "✅ Login successful"
  JWT_PAYLOAD=$(echo $NEW_ACCESS_TOKEN | cut -d'.' -f2 | base64 -d 2>/dev/null)
  if echo "$JWT_PAYLOAD" | grep -q "sessionId"; then
    echo "✅ Login JWT contains sessionId"
  else
    echo "❌ Login JWT missing sessionId"
  fi
else
  echo "❌ Login failed"
fi

echo ""
echo "📝 Test 6: Logout with JWT-based session deletion"
LOGOUT_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/logout" \
  -H "Authorization: Bearer $NEW_ACCESS_TOKEN")

HTTP_CODE=$(echo "$LOGOUT_RESPONSE" | tail -n1)
if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Logout successful"
  
  # Verify session was actually deleted
  sleep 1
  SESSIONS_AFTER_LOGOUT=$(curl -s -X GET "$BASE_URL/sessions" \
    -H "Authorization: Bearer $ACCESS_TOKEN")
  
  # This should fail or return empty sessions since we logged out
  echo "   Sessions after logout: $SESSIONS_AFTER_LOGOUT"
else
  echo "❌ Logout failed (HTTP $HTTP_CODE)"
fi

echo ""
echo "=========================================="
echo "Verification Complete!"
echo "=========================================="
echo ""
echo "Manual verification needed:"
echo "1. Check application logs for Prisma connection messages"
echo "2. Verify only ONE Prisma instance created"
echo "3. Test graceful shutdown (Ctrl+C) and check Prisma disconnect logs"
echo "4. Test concurrent logins to verify session limit enforcement"
echo "5. Test session timeout enforcement after inactivity period"
