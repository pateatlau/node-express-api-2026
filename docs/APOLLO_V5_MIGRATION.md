# Apollo Server v5 Migration Plan

## Overview

Apollo Server v4 reaches End of Life (EOL) on **January 31, 2026**. This document outlines the migration strategy from Apollo Server v4 to v5.

**Current Version:** Apollo Server 4.12.2  
**Target Version:** Apollo Server 5.x  
**Migration Deadline:** Before January 31, 2026  
**Recommended Timeline:** Q4 2025

---

## Breaking Changes Summary

### 1. Node.js Version Requirement

- **v4:** Works with Node.js 14+
- **v5:** Requires Node.js **18+** (Already using Node.js 22)

### 2. **Package Changes**

- `@apollo/server` - Main package (no changes)
- `graphql` peer dependency updated to v16.6.0+
- WebSocket server integration changes

### 3. **Subscription Server Changes**

Apollo Server v5 removes built-in subscription support. Must use separate packages:

**Before (v4):**

```typescript
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/lib/use/ws';
```

**After (v5):**

```typescript
// Same approach, but with updated configuration
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/lib/use/ws';
```

### 4. **Context Function Changes**

Context function signature updated for better type safety:

**Before (v4):**

```typescript
const server = new ApolloServer({
  typeDefs,
  resolvers,
  context: ({ req }) => ({
    user: req.user,
  }),
});
```

**After (v5):**

```typescript
const server = new ApolloServer({
  typeDefs,
  resolvers,
});

// Context passed separately to expressMiddleware
app.use(
  '/graphql',
  expressMiddleware(server, {
    context: async ({ req }) => ({
      user: req.user,
    }),
  })
);
```

### 5. **Plugin API Changes**

- `serverWillStart` hook signature updated
- `requestDidStart` hook signature updated
- Better TypeScript types for plugin development

### 6. **Error Handling Changes**

- Improved error formatting
- Better stack trace handling in development
- Enhanced error extensions

### 7. **Introspection Changes**

- Introspection now disabled by default in production
- Must explicitly enable if needed

---

## Migration Steps

### Phase 1: Preparation (1 week)

#### 1.1 Audit Current Implementation

- [x] Review current Apollo Server v4 usage
- [ ] Document all custom plugins
- [ ] List all context dependencies
- [ ] Check subscription implementation
- [ ] Review error handling patterns

#### 1.2 Update Dependencies

```bash
# Check current versions
npm list @apollo/server graphql graphql-ws

# Update to latest v4 first (if not already)
npm install @apollo/server@latest
```

#### 1.3 Create Test Environment

- [ ] Create separate branch for migration
- [ ] Set up staging environment
- [ ] Prepare rollback plan

### Phase 2: Code Updates (1-2 weeks)

#### 2.1 Update Package.json

```json
{
  "dependencies": {
    "@apollo/server": "^5.0.0",
    "graphql": "^16.8.0",
    "graphql-ws": "^5.16.0",
    "ws": "^8.18.0"
  }
}
```

#### 2.2 Update Server Configuration

**File: `src/graphql/server.ts`**

**Before (v4):**

```typescript
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { makeExecutableSchema } from '@graphql-tools/schema';

const schema = makeExecutableSchema({ typeDefs, resolvers });

const server = new ApolloServer({
  schema,
  plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
  introspection: process.env.NODE_ENV !== 'production',
});

await server.start();

app.use('/graphql', cors(), json(), expressMiddleware(server));
```

**After (v5):**

```typescript
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { makeExecutableSchema } from '@graphql-tools/schema';

const schema = makeExecutableSchema({ typeDefs, resolvers });

const server = new ApolloServer({
  schema,
  plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
  // Introspection must be explicitly enabled in v5
  introspection: process.env.NODE_ENV === 'development',
  includeStacktraceInErrorResponses: process.env.NODE_ENV === 'development',
});

await server.start();

app.use(
  '/graphql',
  cors<cors.CorsRequest>(),
  json(),
  expressMiddleware(server, {
    context: async ({ req }) => ({
      // Context now passed here instead of ApolloServer constructor
      dataLoaders: {
        todoLoader: createTodoDataLoader(repository),
      },
    }),
  })
);
```

#### 2.3 Update WebSocket/Subscription Server

**No major changes needed**, but verify configuration:

```typescript
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/lib/use/ws';

const wsServer = new WebSocketServer({
  server: httpServer,
  path: '/graphql',
});

useServer(
  {
    schema,
    context: (ctx) => {
      // Context for subscriptions
      return {
        connectionParams: ctx.connectionParams,
      };
    },
  },
  wsServer
);
```

#### 2.4 Update Custom Plugins

If you have custom plugins, update to new API:

```typescript
const myPlugin = {
  async serverWillStart() {
    logger.info('GraphQL server starting');
  },
  async requestDidStart() {
    return {
      async didEncounterErrors(requestContext) {
        logger.error('GraphQL error', {
          errors: requestContext.errors,
        });
      },
    };
  },
};
```

#### 2.5 Update Error Handling

```typescript
import { GraphQLError } from 'graphql';

// In resolvers
throw new GraphQLError('User not found', {
  extensions: {
    code: 'USER_NOT_FOUND',
    http: { status: 404 },
  },
});
```

### Phase 3: Testing (1 week)

#### 3.1 Unit Tests

- [ ] Update test mocks for new context signature
- [ ] Test all GraphQL queries
- [ ] Test all GraphQL mutations
- [ ] Test GraphQL subscriptions
- [ ] Test error scenarios

#### 3.2 Integration Tests

```typescript
// Update test setup
import { ApolloServer } from '@apollo/server';

describe('GraphQL API', () => {
  let server: ApolloServer;

  beforeAll(async () => {
    server = new ApolloServer({
      typeDefs,
      resolvers,
    });
    await server.start();
  });

  afterAll(async () => {
    await server.stop();
  });

  it('should query todos', async () => {
    const response = await server.executeOperation({
      query: 'query { todos { id title } }',
    });

    expect(response.body.kind).toBe('single');
    expect(response.body.singleResult.errors).toBeUndefined();
  });
});
```

#### 3.3 Performance Testing

- [ ] Load test GraphQL queries
- [ ] Test subscription performance
- [ ] Monitor memory usage
- [ ] Compare v4 vs v5 metrics

### Phase 4: Deployment (1 week)

#### 4.1 Staging Deployment

- [ ] Deploy to staging environment
- [ ] Run smoke tests
- [ ] Monitor for errors
- [ ] Validate subscriptions work
- [ ] Check introspection settings

#### 4.2 Production Deployment

- [ ] Create deployment checklist
- [ ] Schedule maintenance window (if needed)
- [ ] Deploy with feature flag (optional)
- [ ] Monitor error rates
- [ ] Monitor performance metrics

#### 4.3 Rollback Plan

```bash
# If issues arise, rollback to v4
npm install @apollo/server@^4.12.2

# Revert code changes
git revert <migration-commit>

# Redeploy
npm run build
npm start
```

---

## Code Changes Checklist

### Required Changes

- [ ] Update `package.json` dependencies
- [ ] Move context from ApolloServer constructor to expressMiddleware
- [ ] Update introspection configuration
- [ ] Update error handling to use GraphQLError
- [ ] Verify WebSocket server configuration
- [ ] Update TypeScript types for context

### Optional Improvements

- [ ] Add custom error formatting plugin
- [ ] Implement request tracing plugin
- [ ] Add performance monitoring plugin
- [ ] Enhance error logging
- [ ] Add query complexity limits

---

## Files to Update

| File                                       | Changes Required                        | Priority |
| ------------------------------------------ | --------------------------------------- | -------- |
| `package.json`                             | Update Apollo Server version            | High     |
| `src/graphql/server.ts`                    | Context migration, introspection config | High     |
| `src/graphql/resolvers/*.ts`               | Error handling updates                  | Medium   |
| `src/__tests__/todos-graphql.test.ts`      | Test setup updates                      | High     |
| `src/graphql/__tests__/dataloader.test.ts` | Mock updates                            | Medium   |
| `README.md`                                | Update version references               | Low      |
| `GRAPHQL_EXAMPLES.md`                      | Update examples if needed               | Low      |

---

## Testing Strategy

### Automated Tests

```bash
# Run all tests
npm test

# Run GraphQL tests specifically
npm test -- src/__tests__/todos-graphql.test.ts
npm test -- src/graphql/__tests__/

# Run with coverage
npm run test:coverage
```

### Manual Testing

#### 1. Test Queries

```graphql
query {
  todos(filter: { completed: false }) {
    id
    title
    completed
  }
}
```

#### 2. Test Mutations

```graphql
mutation {
  createTodo(input: { title: "Test Migration", completed: false }) {
    id
    title
  }
}
```

#### 3. Test Subscriptions

```graphql
subscription {
  todoChanged {
    id
    title
    completed
  }
}
```

#### 4. Test Error Handling

```graphql
query {
  todo(id: "nonexistent") {
    id
  }
}
```

---

## Risk Assessment

### Low Risk

- Node.js version compatible (using v22)
- No major API changes in core functionality
- Subscription setup already follows best practices

### Medium Risk

- Context function signature change (requires code updates)
- Test mocks need updating
- Plugin API changes (if using custom plugins)

### High Risk

- None identified

---

## Performance Considerations

### Expected Improvements in v5

- Better TypeScript type inference
- Improved error handling performance
- More efficient plugin system
- Reduced memory footprint

### Metrics to Monitor

- Query response time (should be similar or better)
- Subscription connection stability
- Memory usage (should decrease)
- CPU usage (should be similar)
- Error rate (should remain same)

---

## Rollback Strategy

### If Critical Issues Arise

1. **Immediate Rollback**

   ```bash
   git revert <migration-commit>
   npm install
   npm run build
   docker-compose up -d
   ```

2. **Gradual Rollback** (if using feature flags)
   - Disable v5 features
   - Route traffic back to v4
   - Investigate issues
   - Fix and redeploy

3. **Data Considerations**
   - No database schema changes required
   - No data migration needed
   - Safe to rollback at any time

---

## Timeline

| Phase                 | Duration    | Start  | End    |
| --------------------- | ----------- | ------ | ------ |
| Phase 1: Preparation  | 1 week      | Week 1 | Week 1 |
| Phase 2: Code Updates | 2 weeks     | Week 2 | Week 3 |
| Phase 3: Testing      | 1 week      | Week 4 | Week 4 |
| Phase 4: Deployment   | 1 week      | Week 5 | Week 5 |
| **Total**             | **5 weeks** | -      | -      |

**Recommended Start Date:** December 2025  
**Target Completion:** Mid-January 2026  
**Buffer:** 2 weeks before EOL

---

## Resources

- [Apollo Server v5 Migration Guide](https://www.apollographql.com/docs/apollo-server/migration/)
- [Apollo Server v5 Changelog](https://github.com/apollographql/apollo-server/blob/main/CHANGELOG.md)
- [Apollo Server v5 Documentation](https://www.apollographql.com/docs/apollo-server/)
- [GraphQL.js v16 Changes](https://github.com/graphql/graphql-js/releases)

---

## Success Criteria

- [ ] All tests passing with v5
- [ ] Zero regression in functionality
- [ ] Performance metrics within 5% of v4
- [ ] Subscriptions working correctly
- [ ] Error handling working as expected
- [ ] Introspection configured correctly
- [ ] Documentation updated
- [ ] Team trained on changes

---

## Post-Migration Tasks

- [ ] Monitor production for 1 week
- [ ] Review performance metrics
- [ ] Update documentation
- [ ] Archive v4-specific code
- [ ] Share learnings with team
- [ ] Update CI/CD pipelines if needed

---

## Notes

- Migration is relatively straightforward
- Main changes are in server configuration
- Context function is the biggest change
- No breaking changes for clients/frontend
- Subscriptions continue to work the same way
- Good opportunity to review and improve GraphQL implementation

**Status:** ⏳ Planning Phase  
**Last Updated:** November 12, 2025  
**Owner:** Development Team
