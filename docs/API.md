# API Documentation

## Overview

This document describes all available REST and GraphQL endpoints for the Todo application with authentication and role-based access control (RBAC).

**Base URL**: `http://localhost:4000` (development)

**Authentication**: Bearer token in `Authorization` header

---

## Table of Contents

1. [Authentication REST API](#authentication-rest-api)
2. [Todo REST API](#todo-rest-api)
3. [GraphQL API](#graphql-api)
4. [Rate Limiting](#rate-limiting)
5. [Error Responses](#error-responses)

---

## Authentication REST API

### POST /api/auth/signup

Register a new user account.

**Authentication**: Not required

**Request Body**:

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePass123!",
  "role": "STARTER"
}
```

**Roles**: `STARTER` | `PRO`

**Response** (201 Created):

```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": "uuid",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "STARTER",
      "createdAt": "2025-11-12T10:00:00.000Z",
      "updatedAt": "2025-11-12T10:00:00.000Z"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Cookies Set**:

- `refreshToken`: HttpOnly cookie, expires in 7 days

**Errors**:

- `400`: Invalid input or email already exists
- `500`: Server error

---

### POST /api/auth/login

Login with email and password.

**Authentication**: Not required

**Request Body**:

```json
{
  "email": "john@example.com",
  "password": "SecurePass123!"
}
```

**Response** (200 OK):

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "uuid",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "STARTER",
      "lastActivityAt": "2025-11-12T10:00:00.000Z",
      "createdAt": "2025-11-12T10:00:00.000Z",
      "updatedAt": "2025-11-12T10:00:00.000Z"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Cookies Set**:

- `refreshToken`: HttpOnly cookie, expires in 7 days

**Errors**:

- `401`: Invalid credentials
- `500`: Server error

---

### POST /api/auth/logout

Logout current user (clears refresh token cookie).

**Authentication**: Not required (but recommended)

**Response** (200 OK):

```json
{
  "success": true,
  "message": "Logout successful"
}
```

**Cookies Cleared**:

- `refreshToken`

---

### POST /api/auth/refresh

Refresh access token using refresh token from cookie.

**Authentication**: Requires `refreshToken` cookie

**Response** (200 OK):

```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Errors**:

- `401`: No refresh token or invalid/expired token

---

### GET /api/auth/me

Get current authenticated user information. Also updates `lastActivityAt` for session management.

**Authentication**: Required (Bearer token)

**Headers**:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "STARTER",
      "lastActivityAt": "2025-11-12T10:05:00.000Z",
      "createdAt": "2025-11-12T10:00:00.000Z",
      "updatedAt": "2025-11-12T10:05:00.000Z"
    }
  }
}
```

**Errors**:

- `401`: Not authenticated or session expired
- `404`: User not found

---

### GET /api/auth/session

Get current session status and time remaining.

**Authentication**: Required (Bearer token)

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "session": {
      "lastActivityAt": "2025-11-12T10:05:00.000Z",
      "isExpired": false,
      "timeRemainingMs": 240000,
      "timeoutMs": 300000,
      "timeRemainingMinutes": 4
    }
  }
}
```

**Session Info**:

- `lastActivityAt`: Timestamp of last user activity
- `isExpired`: Boolean indicating if session has expired
- `timeRemainingMs`: Milliseconds until session expires
- `timeoutMs`: Total session timeout (300000ms = 5 minutes)
- `timeRemainingMinutes`: Minutes until session expires

**Errors**:

- `401`: Not authenticated or session expired (code: `SESSION_EXPIRED`)

---

## Todo REST API

### GET /api/todos

Get paginated list of todos.

**Authentication**: Required (Bearer token)

**Roles**: All authenticated users (STARTER & PRO)

**Query Parameters**:

- `page` (number, default: 1): Page number
- `limit` (number, default: 10): Items per page

**Example**: `GET /api/todos?page=1&limit=10`

**Response** (200 OK):

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "title": "Buy groceries",
      "completed": false,
      "createdAt": "2025-11-12T10:00:00.000Z",
      "updatedAt": "2025-11-12T10:00:00.000Z"
    }
  ],
  "meta": {
    "total": 25,
    "page": 1,
    "limit": 10,
    "totalPages": 3
  }
}
```

---

### GET /api/todos/:id

Get a single todo by ID.

**Authentication**: Required (Bearer token)

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "Buy groceries",
    "completed": false,
    "createdAt": "2025-11-12T10:00:00.000Z",
    "updatedAt": "2025-11-12T10:00:00.000Z"
  }
}
```

**Errors**:

- `404`: Todo not found

---

### POST /api/todos

Create a new todo.

**Authentication**: Required (Bearer token)

**Request Body**:

```json
{
  "title": "Buy groceries",
  "completed": false
}
```

**Response** (201 Created):

```json
{
  "success": true,
  "message": "Todo created successfully",
  "data": {
    "id": "uuid",
    "title": "Buy groceries",
    "completed": false,
    "createdAt": "2025-11-12T10:00:00.000Z",
    "updatedAt": "2025-11-12T10:00:00.000Z"
  }
}
```

---

### PUT /api/todos/:id

Update an existing todo.

**Authentication**: Required (Bearer token)

**Request Body**:

```json
{
  "title": "Buy groceries and milk",
  "completed": true
}
```

**Response** (200 OK):

```json
{
  "success": true,
  "message": "Todo updated successfully",
  "data": {
    "id": "uuid",
    "title": "Buy groceries and milk",
    "completed": true,
    "createdAt": "2025-11-12T10:00:00.000Z",
    "updatedAt": "2025-11-12T10:15:00.000Z"
  }
}
```

---

### DELETE /api/todos/:id

Delete a todo.

**Authentication**: Required (Bearer token)

**Response** (200 OK):

```json
{
  "success": true,
  "message": "Todo deleted successfully"
}
```

---

## GraphQL API

**Endpoint**: `POST /graphql`

**WebSocket**: `ws://localhost:4000/graphql` (for subscriptions)

**Authentication**: Required (Bearer token in `Authorization` header)

**Roles**: PRO users only

### Authentication

All GraphQL requests require:

1. Valid JWT access token in `Authorization` header
2. User must have PRO role

**Headers**:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

---

### Query: todos

Get paginated list of todos.

**Request**:

```graphql
query GetTodos($page: Int, $limit: Int) {
  todos(page: $page, limit: $limit) {
    data {
      id
      title
      completed
      createdAt
      updatedAt
    }
    meta {
      total
      page
      limit
      totalPages
    }
  }
}
```

**Variables**:

```json
{
  "page": 1,
  "limit": 10
}
```

**Response**:

```json
{
  "data": {
    "todos": {
      "data": [
        {
          "id": "uuid",
          "title": "Buy groceries",
          "completed": false,
          "createdAt": "2025-11-12T10:00:00.000Z",
          "updatedAt": "2025-11-12T10:00:00.000Z"
        }
      ],
      "meta": {
        "total": 25,
        "page": 1,
        "limit": 10,
        "totalPages": 3
      }
    }
  }
}
```

---

### Query: todo

Get a single todo by ID.

**Request**:

```graphql
query GetTodo($id: ID!) {
  todo(id: $id) {
    id
    title
    completed
    createdAt
    updatedAt
  }
}
```

**Variables**:

```json
{
  "id": "uuid"
}
```

---

### Mutation: createTodo

Create a new todo.

**Request**:

```graphql
mutation CreateTodo($title: String!, $completed: Boolean) {
  createTodo(title: $title, completed: $completed) {
    id
    title
    completed
    createdAt
    updatedAt
  }
}
```

**Variables**:

```json
{
  "title": "Buy groceries",
  "completed": false
}
```

---

### Mutation: updateTodo

Update an existing todo.

**Request**:

```graphql
mutation UpdateTodo($id: ID!, $title: String, $completed: Boolean) {
  updateTodo(id: $id, title: $title, completed: $completed) {
    id
    title
    completed
    createdAt
    updatedAt
  }
}
```

**Variables**:

```json
{
  "id": "uuid",
  "title": "Buy groceries and milk",
  "completed": true
}
```

---

### Mutation: deleteTodo

Delete a todo.

**Request**:

```graphql
mutation DeleteTodo($id: ID!) {
  deleteTodo(id: $id)
}
```

**Variables**:

```json
{
  "id": "uuid"
}
```

**Response**:

```json
{
  "data": {
    "deleteTodo": true
  }
}
```

---

### Subscription: todoAdded

Real-time updates when new todos are created.

**Request**:

```graphql
subscription OnTodoAdded {
  todoAdded {
    id
    title
    completed
    createdAt
    updatedAt
  }
}
```

**Note**: Requires WebSocket connection with authentication token.

---

## Rate Limiting

### General API Endpoints

**Limit**: 500 requests per 15 minutes per IP

**Applies to**: `/api/*` endpoints

**Headers**:

```
RateLimit-Limit: 500
RateLimit-Remaining: 499
RateLimit-Reset: 1699804800
```

**Error Response** (429 Too Many Requests):

```json
{
  "error": "Too many requests",
  "message": "Please try again later.",
  "retryAfter": "900"
}
```

---

### Authentication Endpoints

**Limit**: 5 requests per 15 minutes per IP

**Applies to**: `/api/auth/login`, `/api/auth/signup`

**Purpose**: Prevent brute force attacks

---

### GraphQL Endpoints

**Limit**: 50 requests per 15 minutes per IP

**Applies to**: `/graphql`

---

### Mutation Endpoints

**Limit**: 20 requests per 15 minutes per IP

**Applies to**: POST, PUT, DELETE requests to `/api/todos`

---

## Error Responses

### Standard Error Format

All errors follow this structure:

```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message (in development only)"
}
```

---

### Common HTTP Status Codes

| Code | Meaning               | Description                           |
| ---- | --------------------- | ------------------------------------- |
| 200  | OK                    | Request successful                    |
| 201  | Created               | Resource created successfully         |
| 400  | Bad Request           | Invalid input or validation error     |
| 401  | Unauthorized          | Not authenticated or invalid token    |
| 403  | Forbidden             | Insufficient permissions (wrong role) |
| 404  | Not Found             | Resource not found                    |
| 429  | Too Many Requests     | Rate limit exceeded                   |
| 500  | Internal Server Error | Server error                          |

---

### Authentication Errors

**401 Unauthorized**:

```json
{
  "success": false,
  "message": "No token provided. Please authenticate."
}
```

**401 Session Expired**:

```json
{
  "success": false,
  "message": "Session expired due to inactivity. Please login again.",
  "code": "SESSION_EXPIRED"
}
```

**403 Forbidden (Wrong Role)**:

```json
{
  "success": false,
  "message": "Access denied. Required role: PRO",
  "userRole": "STARTER"
}
```

---

### GraphQL Errors

**Authentication Error**:

```json
{
  "errors": [
    {
      "message": "Authentication required",
      "extensions": {
        "code": "UNAUTHENTICATED"
      }
    }
  ]
}
```

**Authorization Error**:

```json
{
  "errors": [
    {
      "message": "Access denied. Required role: PRO",
      "extensions": {
        "code": "FORBIDDEN",
        "requiredRole": "PRO",
        "userRole": "STARTER"
      }
    }
  ]
}
```

**Rate Limit Error**:

```json
{
  "errors": [
    {
      "message": "Too many requests",
      "extensions": {
        "code": "RATE_LIMIT_EXCEEDED",
        "retryAfter": "900"
      }
    }
  ]
}
```

---

## Token Information

### Access Token

- **Type**: JWT (JSON Web Token)
- **Lifetime**: 15 minutes
- **Storage**: `localStorage` (frontend)
- **Header**: `Authorization: Bearer <token>`
- **Payload**:
  ```json
  {
    "userId": "uuid",
    "email": "john@example.com",
    "role": "STARTER",
    "iat": 1699804800,
    "exp": 1699805700
  }
  ```

### Refresh Token

- **Type**: JWT (JSON Web Token)
- **Lifetime**: 7 days
- **Storage**: HttpOnly cookie (cannot be accessed by JavaScript)
- **Cookie Name**: `refreshToken`
- **Purpose**: Obtain new access token when expired

---

## Session Management

- **Timeout**: 5 minutes of inactivity
- **Warning**: Shown at 1 minute remaining
- **Auto-logout**: After 5 minutes of no activity
- **Activity Tracked**: Any authenticated API call updates `lastActivityAt`
- **Polling**: Frontend polls `/api/auth/session` every 30 seconds

---

## Best Practices

1. **Always** include `Authorization` header for protected endpoints
2. **Never** expose JWT secrets or store them in frontend code
3. **Handle** 401 errors by refreshing token or redirecting to login
4. **Respect** rate limits to avoid temporary bans
5. **Use** HTTPS in production for secure token transmission
6. **Rotate** JWT secrets periodically in production
7. **Monitor** session expiration and warn users before auto-logout

---

## Questions or Issues?

Refer to the [Troubleshooting Guide](./TROUBLESHOOTING.md) for common problems and solutions.
