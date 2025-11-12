import gql from 'graphql-tag';

/**
 * GraphQL Type Definitions
 * Defines the complete schema for the Todo API with queries, mutations, and subscriptions
 */
export const typeDefs = gql`
  """
  Todo item representing a task
  """
  type Todo {
    """
    Unique identifier (UUID for PostgreSQL, ObjectId for MongoDB)
    """
    id: ID!

    """
    Todo title/description
    """
    title: String!

    """
    Completion status
    """
    completed: Boolean!

    """
    Creation timestamp (ISO 8601 format)
    """
    createdAt: String!

    """
    Last update timestamp (ISO 8601 format)
    """
    updatedAt: String!
  }

  """
  Paginated response for todos list
  """
  type TodosResponse {
    """
    Array of todo items
    """
    data: [Todo!]!

    """
    Pagination metadata
    """
    meta: PaginationMeta!
  }

  """
  Pagination metadata information
  """
  type PaginationMeta {
    """
    Total number of items
    """
    total: Int!

    """
    Current page number
    """
    page: Int!

    """
    Items per page
    """
    limit: Int!

    """
    Total number of pages
    """
    totalPages: Int!
  }

  """
  Health check response
  """
  type HealthResponse {
    """
    API status
    """
    status: String!

    """
    Database connection status
    """
    database: String!

    """
    Database type (postgres or mongodb)
    """
    dbType: String
  }

  """
  Input for creating a new todo
  """
  input CreateTodoInput {
    """
    Todo title (required)
    """
    title: String!

    """
    Initial completion status (optional, defaults to false)
    """
    completed: Boolean
  }

  """
  Input for updating an existing todo
  """
  input UpdateTodoInput {
    """
    New title (optional)
    """
    title: String

    """
    New completion status (optional)
    """
    completed: Boolean
  }

  """
  Supported sort orders
  """
  enum SortOrder {
    ASC
    DESC
  }

  """
  Fields available for sorting todos
  """
  enum TodoSortField {
    createdAt
    updatedAt
    title
    completed
  }

  """
  Filter options for querying todos
  """
  input TodoFilterInput {
    """
    Filter by completion status
    """
    completed: Boolean

    """
    Search in title (case-insensitive partial match)
    """
    titleContains: String
  }

  """
  Query operations
  """
  type Query {
    """
    Get paginated list of todos with optional filtering and sorting
    """
    todos(
      page: Int = 1
      limit: Int = 20
      filter: TodoFilterInput
      sortBy: TodoSortField = createdAt
      sortOrder: SortOrder = DESC
    ): TodosResponse!

    """
    Get a single todo by ID
    """
    todo(id: ID!): Todo

    """
    Health check endpoint
    """
    health: HealthResponse!
  }

  """
  Mutation operations
  """
  type Mutation {
    """
    Create a new todo
    """
    createTodo(input: CreateTodoInput!): Todo!

    """
    Update an existing todo
    """
    updateTodo(id: ID!, input: UpdateTodoInput!): Todo

    """
    Delete a todo
    """
    deleteTodo(id: ID!): Boolean!

    """
    Toggle todo completion status
    """
    toggleTodo(id: ID!): Todo
  }

  """
  Subscription operations for real-time updates
  """
  type Subscription {
    """
    Subscribe to all todo changes (created, updated, deleted)
    """
    todoChanged: TodoChangePayload!

    """
    Subscribe only to new todos
    """
    todoCreated: Todo!

    """
    Subscribe only to todo updates
    """
    todoUpdated: Todo!

    """
    Subscribe only to todo deletions
    """
    todoDeleted: ID!
  }

  """
  Payload for todo change subscription with operation type
  """
  type TodoChangePayload {
    """
    Type of operation (CREATED, UPDATED, DELETED)
    """
    operation: String!

    """
    The affected todo (null for DELETE operations)
    """
    todo: Todo

    """
    ID of deleted todo (only for DELETE operations)
    """
    deletedId: ID
  }
`;
