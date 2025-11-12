# GraphQL Examples and Testing Guide

This file contains example queries, mutations, and subscriptions for testing the GraphQL API.

## Access GraphQL

- **HTTP Endpoint**: http://localhost:4000/graphql
- **WebSocket Endpoint**: ws://localhost:4000/graphql
- **Apollo Studio Sandbox**: https://studio.apollographql.com/sandbox/explorer

## Configuration

To enable GraphQL, set in your `.env` or docker-compose:

```env
API_TYPE=graphql  # GraphQL only
API_TYPE=rest     # REST only
API_TYPE=both     # Both APIs (default)
```

---

## Queries

### 1. Get All Todos (with Pagination)

```graphql
query GetTodos {
  todos(page: 1, limit: 10) {
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

### 2. Get Todos with Filtering

```graphql
query GetCompletedTodos {
  todos(
    page: 1
    limit: 20
    filter: { completed: true }
    sortBy: createdAt
    sortOrder: DESC
  ) {
    data {
      id
      title
      completed
    }
    meta {
      total
    }
  }
}
```

### 3. Search Todos by Title

```graphql
query SearchTodos {
  todos(filter: { titleContains: "index" }) {
    data {
      id
      title
      completed
    }
    meta {
      total
    }
  }
}
```

### 4. Get Single Todo by ID

```graphql
query GetTodo {
  todo(id: "YOUR_TODO_ID_HERE") {
    id
    title
    completed
    createdAt
    updatedAt
  }
}
```

### 5. Health Check

```graphql
query HealthCheck {
  health {
    status
    database
    dbType
  }
}
```

---

## Mutations

### 1. Create a New Todo

```graphql
mutation CreateTodo {
  createTodo(input: { title: "Learn GraphQL", completed: false }) {
    id
    title
    completed
    createdAt
    updatedAt
  }
}
```

### 2. Update a Todo

```graphql
mutation UpdateTodo {
  updateTodo(
    id: "YOUR_TODO_ID_HERE"
    input: { title: "Updated title", completed: true }
  ) {
    id
    title
    completed
    updatedAt
  }
}
```

### 3. Toggle Todo Completion

```graphql
mutation ToggleTodo {
  toggleTodo(id: "YOUR_TODO_ID_HERE") {
    id
    title
    completed
    updatedAt
  }
}
```

### 4. Delete a Todo

```graphql
mutation DeleteTodo {
  deleteTodo(id: "YOUR_TODO_ID_HERE")
}
```

---

## Subscriptions

Subscriptions use WebSocket for real-time updates. Connect to `ws://localhost:4000/graphql`.

### 1. Subscribe to All Changes

```graphql
subscription TodoChanges {
  todoChanged {
    operation
    todo {
      id
      title
      completed
    }
    deletedId
  }
}
```

### 2. Subscribe to New Todos Only

```graphql
subscription NewTodos {
  todoCreated {
    id
    title
    completed
    createdAt
  }
}
```

### 3. Subscribe to Updates Only

```graphql
subscription TodoUpdates {
  todoUpdated {
    id
    title
    completed
    updatedAt
  }
}
```

### 4. Subscribe to Deletions Only

```graphql
subscription TodoDeletions {
  todoDeleted
}
```

---

## Testing with Apollo Studio Sandbox

1. Go to https://studio.apollographql.com/sandbox/explorer
2. Enter your endpoint: `http://localhost:4000/graphql`
3. For subscriptions, the WebSocket connection will be automatic
4. Use the schema browser on the left to explore available operations
5. Use the "Documentation" tab to see field descriptions

---

## Testing with curl

### Query Example

```bash
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query { todos(page: 1, limit: 5) { data { id title completed } meta { total } } }"
  }'
```

### Mutation Example

```bash
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation { createTodo(input: { title: \"Test from curl\", completed: false }) { id title completed } }"
  }'
```

---

## Advanced Features

### DataLoader (Automatic)

DataLoader automatically batches and caches requests within a single GraphQL operation:

```graphql
# This will efficiently batch the todo lookups
query MultipleDetails {
  todo1: todo(id: "id1") {
    id
    title
  }
  todo2: todo(id: "id2") {
    id
    title
  }
  todo3: todo(id: "id3") {
    id
    title
  }
}
```

### Complex Filtering and Sorting

```graphql
query ComplexQuery {
  incomplete: todos(
    filter: { completed: false, titleContains: "index" }
    sortBy: title
    sortOrder: ASC
    limit: 10
  ) {
    data {
      id
      title
    }
    meta {
      total
    }
  }
}
```

---

## Error Handling

GraphQL returns errors in a structured format:

```json
{
  "errors": [
    {
      "message": "Todo with ID abc123 not found",
      "locations": [{ "line": 2, "column": 3 }],
      "path": ["todo"]
    }
  ],
  "data": {
    "todo": null
  }
}
```

---

## Performance Tips

1. **Use DataLoader**: Automatically enabled, batches and caches database queries
2. **Limit Fields**: Only query fields you need
3. **Pagination**: Use `page` and `limit` for large datasets
4. **Filtering**: Filter at the server level instead of client-side
5. **Subscriptions**: Only subscribe when you need real-time updates

---

## Switching Between APIs

### Use Both (Default)

```env
API_TYPE=both
```

Access:

- REST: `http://localhost:4000/api/todos`
- GraphQL: `http://localhost:4000/graphql`

### GraphQL Only

```env
API_TYPE=graphql
```

Access:

- GraphQL: `http://localhost:4000/graphql`
- REST endpoints disabled

### REST Only

```env
API_TYPE=rest
```

Access:

- REST: `http://localhost:4000/api/todos`
- GraphQL endpoint disabled
