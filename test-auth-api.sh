#!/bin/bash

# Test Auth API Endpoints

BASE_URL="http://localhost:4000/api/auth"

echo "=== Auth API Testing ==="
echo ""

# Test 1: Signup (PRO user)
echo "1. Testing Signup (PRO user)..."
SIGNUP_RESPONSE=$(curl -s -X POST "$BASE_URL/signup" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "password123",
    "role": "PRO"
  }')

echo "$SIGNUP_RESPONSE" | jq .
ACCESS_TOKEN=$(echo "$SIGNUP_RESPONSE" | jq -r '.data.accessToken')
echo "Access Token: ${ACCESS_TOKEN:0:50}..."
echo ""

# Test 2: Signup (STARTER user)
echo "2. Testing Signup (STARTER user)..."
curl -s -X POST "$BASE_URL/signup" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jane Smith",
    "email": "jane@example.com",
    "password": "password456",
    "role": "STARTER"
  }' | jq .
echo ""

# Test 3: Login
echo "3. Testing Login..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "password123"
  }')

echo "$LOGIN_RESPONSE" | jq .
ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.accessToken')
echo ""

# Test 4: Get Current User (me)
echo "4. Testing /me endpoint (authenticated)..."
curl -s -X GET "$BASE_URL/me" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq .
echo ""

# Test 5: Invalid credentials
echo "5. Testing Login with invalid credentials..."
curl -s -X POST "$BASE_URL/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "wrongpassword"
  }' | jq .
echo ""

# Test 6: Missing token
echo "6. Testing /me without token..."
curl -s -X GET "$BASE_URL/me" | jq .
echo ""

# Test 7: Logout
echo "7. Testing Logout..."
curl -s -X POST "$BASE_URL/logout" | jq .
echo ""

echo "=== Testing Complete ==="
