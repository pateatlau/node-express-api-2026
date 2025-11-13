# AI Microservice Implementation Plan (Hybrid Approach)

## 🎯 Overview

**Goal**: Add AI Agent capabilities as a separate microservice while keeping the existing monolith intact.

**Timeline**: 2-3 weeks  
**Effort**: Medium  
**Risk**: Low (non-breaking, additive change)

---

## 📋 High-Level Architecture

### Current State

```
Frontend (5173) → Caddy (8080) → Backend x3 (4000) → PostgreSQL
                                                    → MongoDB
                                                    → Redis
```

### Target State

```
Frontend (5173) → Caddy (8080) → Backend x3 (4000) → PostgreSQL
                              ↓                     → MongoDB
                              ↓                     → Redis
                              ↓
                              └→ AI Service (4002) → PostgreSQL (ai_db)
                                                   → Vector DB (Pinecone/Weaviate)
                                                   → Redis (cache)
                                                   → OpenAI API
```

---

## 🗓️ Week-by-Week Breakdown

### **Week 1: Foundation & Setup**

#### Day 1-2: Infrastructure Setup

- [ ] Create AI service directory structure
- [ ] Setup TypeScript + Express boilerplate
- [ ] Configure Docker container
- [ ] Update docker-compose with AI service
- [ ] Update Caddyfile routing
- [ ] Setup environment variables

#### Day 3-4: Database & Authentication

- [ ] Create PostgreSQL database for AI service
- [ ] Design conversation schema (conversations, messages)
- [ ] Setup Prisma ORM for AI service
- [ ] Implement JWT validation middleware
- [ ] Setup service-to-service auth with main backend

#### Day 5: LLM Integration

- [ ] Setup OpenAI/Anthropic API client
- [ ] Implement basic chat endpoint
- [ ] Test LLM connectivity
- [ ] Add error handling & retries
- [ ] Implement streaming responses (optional)

---

### **Week 2: Core Features**

#### Day 1-2: Chat API

- [ ] POST /api/ai/chat - Send message
- [ ] GET /api/ai/conversations - List conversations
- [ ] GET /api/ai/conversations/:id - Get conversation history
- [ ] DELETE /api/ai/conversations/:id - Delete conversation
- [ ] Implement conversation context management

#### Day 3: Real-time Integration

- [ ] WebSocket support for streaming responses
- [ ] Integrate with existing Socket.IO via Redis
- [ ] Broadcast typing indicators
- [ ] Emit chat completion events

#### Day 4-5: Advanced Features

- [ ] System prompts management
- [ ] Token counting & cost tracking
- [ ] Rate limiting per user
- [ ] Conversation summarization
- [ ] Export conversation history

---

### **Week 3: RAG, Testing & Polish**

#### Day 1-2: RAG Implementation (Optional)

- [ ] Setup vector database (Pinecone/Weaviate)
- [ ] Implement document embedding
- [ ] Create vector search service
- [ ] Integrate RAG with chat endpoint
- [ ] Add knowledge base management API

#### Day 3: Frontend Integration

- [ ] Create AI chat UI component
- [ ] Implement message streaming display
- [ ] Add conversation sidebar
- [ ] Connect to WebSocket for real-time updates
- [ ] Error handling & loading states

#### Day 4: Testing

- [ ] Unit tests for AI service
- [ ] Integration tests with main backend
- [ ] Load testing (concurrent conversations)
- [ ] Test token limits & error scenarios

#### Day 5: Documentation & Deployment

- [ ] API documentation (OpenAPI/Swagger)
- [ ] Update SYSTEM_ARCHITECTURE.md
- [ ] Deployment guide
- [ ] Monitoring setup (Prometheus metrics)
- [ ] Logging configuration

---

## 📁 Directory Structure

```
node-express-api-2026/
├── src/                              # Existing monolith
│   ├── routes/
│   ├── services/
│   └── ...
│
└── services/
    └── ai-agent-service/            # NEW AI Microservice
        ├── src/
        │   ├── routes/
        │   │   ├── chat.routes.ts          # Chat endpoints
        │   │   ├── conversation.routes.ts  # Conversation management
        │   │   └── admin.routes.ts         # Admin endpoints
        │   │
        │   ├── services/
        │   │   ├── llm.service.ts          # OpenAI/Anthropic integration
        │   │   ├── conversation.service.ts # Conversation logic
        │   │   ├── embedding.service.ts    # Vector embeddings
        │   │   ├── rag.service.ts          # RAG implementation
        │   │   └── cost.service.ts         # Token counting & costs
        │   │
        │   ├── middleware/
        │   │   ├── authenticate.ts         # JWT validation
        │   │   └── rateLimiter.ts          # AI-specific rate limits
        │   │
        │   ├── models/
        │   │   └── types.ts                # TypeScript interfaces
        │   │
        │   ├── utils/
        │   │   ├── tokenCounter.ts         # Token counting
        │   │   └── promptBuilder.ts        # Prompt templates
        │   │
        │   ├── websocket/
        │   │   └── index.ts                # Socket.IO for streaming
        │   │
        │   └── index.ts                    # Service entry point
        │
        ├── prisma/
        │   ├── schema.prisma               # AI database schema
        │   └── migrations/
        │
        ├── tests/
        │   ├── unit/
        │   └── integration/
        │
        ├── .env.example
        ├── Dockerfile
        ├── package.json
        ├── tsconfig.json
        └── README.md
```

---

## 🗄️ Database Schema (AI Service)

```prisma
// prisma/schema.prisma

model Conversation {
  id          String    @id @default(uuid())
  userId      String
  title       String?
  metadata    Json?     // Store model, temperature, etc.
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  messages    Message[]

  @@index([userId])
}

model Message {
  id              String       @id @default(uuid())
  conversationId  String
  role            Role         // user, assistant, system
  content         String       @db.Text
  tokens          Int?         // Token count
  cost            Float?       // Cost in USD
  metadata        Json?        // Model version, latency, etc.
  createdAt       DateTime     @default(now())

  conversation    Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)

  @@index([conversationId])
}

enum Role {
  user
  assistant
  system
}

model KnowledgeBase {
  id          String   @id @default(uuid())
  userId      String
  name        String
  description String?
  documents   Document[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([userId])
}

model Document {
  id              String        @id @default(uuid())
  knowledgeBaseId String
  title           String
  content         String        @db.Text
  vectorId        String?       // Reference to vector DB
  metadata        Json?
  createdAt       DateTime      @default(now())

  knowledgeBase   KnowledgeBase @relation(fields: [knowledgeBaseId], references: [id], onDelete: Cascade)

  @@index([knowledgeBaseId])
}
```

---

## 🔌 API Endpoints

### Chat Endpoints

```typescript
POST   /api/ai/chat
GET    /api/ai/conversations
GET    /api/ai/conversations/:id
POST   /api/ai/conversations
DELETE /api/ai/conversations/:id
PATCH  /api/ai/conversations/:id
```

### Knowledge Base (RAG)

```typescript
POST   /api/ai/knowledge
GET    /api/ai/knowledge
POST   /api/ai/knowledge/:id/documents
DELETE /api/ai/knowledge/:id
GET    /api/ai/knowledge/:id/search
```

### Admin

```typescript
GET    /api/ai/admin/usage        # Token usage stats
GET    /api/ai/admin/costs        # Cost analytics
GET    /api/ai/admin/health       # Service health
```

---

## 🔧 Configuration Files

### docker-compose.caddy.yml Updates

```yaml
services:
  # Existing services...

  ai-service:
    build: ./services/ai-agent-service
    container_name: ai-service
    ports:
      - '4002:4002'
    environment:
      - PORT=4002
      - NODE_ENV=development
      - DATABASE_URL=postgresql://todouser:todopassword@postgres-ai:5432/ai_db
      - REDIS_URL=redis://redis-caddy:6379
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - JWT_SECRET=${JWT_SECRET}
      - MAIN_BACKEND_URL=http://backend-1:4000
      - VECTOR_DB_URL=${VECTOR_DB_URL} # Optional
    depends_on:
      - postgres-ai
      - redis-caddy
    volumes:
      - ./services/ai-agent-service/src:/app/src
    networks:
      - caddy-network
    restart: unless-stopped

  postgres-ai:
    image: postgres:16-alpine
    container_name: postgres-ai
    environment:
      - POSTGRES_USER=todouser
      - POSTGRES_PASSWORD=todopassword
      - POSTGRES_DB=ai_db
    ports:
      - '5433:5432' # Different port to avoid conflict
    volumes:
      - postgres-ai-data:/var/lib/postgresql/data
    networks:
      - caddy-network
    restart: unless-stopped

volumes:
  postgres-ai-data:
```

### Caddyfile Updates

```caddyfile
:8080 {
    # Health check endpoint
    handle /health {
        respond "OK" 200
    }

    # AI Service routes
    handle /api/ai/* {
        reverse_proxy ai-service:4002
    }

    # Existing routes for main backend
    handle /api/* {
        reverse_proxy {
            to backend-1:4000 backend-2:4000 backend-3:4000
            lb_policy round_robin
            health_uri /health
            health_interval 10s
        }
    }

    # WebSocket for AI streaming
    handle /socket.io/* {
        reverse_proxy {
            to backend-1:4000 backend-2:4000 backend-3:4000 ai-service:4002
            lb_policy round_robin
        }
    }
}
```

---

## 💻 Core Implementation Examples

### 1. Chat Endpoint

```typescript
// src/routes/chat.routes.ts
import express from 'express';
import { authenticate } from '../middleware/authenticate';
import { LLMService } from '../services/llm.service';
import { ConversationService } from '../services/conversation.service';

const router = express.Router();

router.post('/chat', authenticate, async (req, res) => {
  const { message, conversationId, model = 'gpt-4' } = req.body;
  const userId = req.user!.id;

  try {
    // Get or create conversation
    const conversation = conversationId
      ? await ConversationService.get(conversationId)
      : await ConversationService.create(userId, model);

    // Save user message
    await ConversationService.addMessage(conversation.id, {
      role: 'user',
      content: message,
    });

    // Get conversation history
    const history = await ConversationService.getHistory(conversation.id);

    // Call LLM
    const response = await LLMService.chat({
      model,
      messages: history,
      userId,
    });

    // Save assistant message
    await ConversationService.addMessage(conversation.id, {
      role: 'assistant',
      content: response.content,
      tokens: response.tokens,
      cost: response.cost,
    });

    // Broadcast via WebSocket
    io.to(`user:${userId}`).emit('ai-message', {
      conversationId: conversation.id,
      message: response.content,
    });

    res.json({
      success: true,
      data: {
        conversationId: conversation.id,
        message: response.content,
        tokens: response.tokens,
        cost: response.cost,
      },
    });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process chat message',
    });
  }
});

export default router;
```

### 2. LLM Service

```typescript
// src/services/llm.service.ts
import OpenAI from 'openai';
import { countTokens } from '../utils/tokenCounter';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export class LLMService {
  static async chat(params: {
    model: string;
    messages: Array<{ role: string; content: string }>;
    userId: string;
  }) {
    const { model, messages, userId } = params;

    // Add system prompt
    const systemPrompt = {
      role: 'system',
      content: 'You are a helpful AI assistant for the Todo app.',
    };

    const completion = await openai.chat.completions.create({
      model,
      messages: [systemPrompt, ...messages],
      temperature: 0.7,
      max_tokens: 1000,
    });

    const response = completion.choices[0].message;
    const tokens = completion.usage?.total_tokens || 0;
    const cost = this.calculateCost(model, tokens);

    return {
      content: response.content || '',
      tokens,
      cost,
      model: completion.model,
    };
  }

  static calculateCost(model: string, tokens: number): number {
    // GPT-4: $0.03 / 1K input tokens, $0.06 / 1K output tokens
    // Simplified calculation
    const costPer1k = model.includes('gpt-4') ? 0.045 : 0.002;
    return (tokens / 1000) * costPer1k;
  }

  static async stream(params: {
    model: string;
    messages: Array<{ role: string; content: string }>;
    onToken: (token: string) => void;
  }) {
    const stream = await openai.chat.completions.create({
      model: params.model,
      messages: params.messages,
      stream: true,
    });

    let fullContent = '';
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        fullContent += content;
        params.onToken(content);
      }
    }

    return fullContent;
  }
}
```

### 3. Service-to-Service Auth

```typescript
// src/middleware/authenticate.ts
import jwt from 'jsonwebtoken';
import axios from 'axios';

export async function authenticate(req: any, res: any, next: any) {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    // Option 1: Validate JWT locally (if shared secret)
    const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    req.user = decoded;
    next();
  } catch (err) {
    // Option 2: Call main backend to validate
    try {
      const response = await axios.get(`${process.env.MAIN_BACKEND_URL}/api/auth/verify`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      req.user = response.data.user;
      next();
    } catch (error) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  }
}
```

---

## 🧪 Testing Strategy

### Unit Tests

```typescript
// tests/unit/llm.service.test.ts
describe('LLMService', () => {
  it('should call OpenAI API with correct parameters', async () => {
    const result = await LLMService.chat({
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Hello' }],
      userId: 'test-user',
    });

    expect(result.content).toBeDefined();
    expect(result.tokens).toBeGreaterThan(0);
    expect(result.cost).toBeGreaterThan(0);
  });
});
```

### Integration Tests

```typescript
// tests/integration/chat.test.ts
describe('POST /api/ai/chat', () => {
  it('should create conversation and return response', async () => {
    const response = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${validToken}`)
      .send({
        message: 'What is 2+2?',
      });

    expect(response.status).toBe(200);
    expect(response.body.data.message).toBeDefined();
    expect(response.body.data.conversationId).toBeDefined();
  });
});
```

---

## 📊 Monitoring & Metrics

### Prometheus Metrics

```typescript
// Add to AI service
import { Counter, Histogram } from 'prom-client';

const chatRequests = new Counter({
  name: 'ai_chat_requests_total',
  help: 'Total number of chat requests',
  labelNames: ['model', 'status'],
});

const chatDuration = new Histogram({
  name: 'ai_chat_duration_seconds',
  help: 'Duration of chat requests',
  labelNames: ['model'],
});

const tokenUsage = new Counter({
  name: 'ai_tokens_used_total',
  help: 'Total tokens used',
  labelNames: ['model', 'userId'],
});

const costAccrued = new Counter({
  name: 'ai_cost_usd_total',
  help: 'Total cost in USD',
  labelNames: ['model', 'userId'],
});
```

---

## 🚀 Deployment Steps

### Development

```bash
# 1. Start AI service
cd node-express-api-2026
docker-compose -f docker-compose.caddy.yml up -d ai-service postgres-ai

# 2. Run migrations
docker exec ai-service npx prisma migrate dev

# 3. Test endpoint
curl -X POST http://localhost:8080/api/ai/chat \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello AI!"}'
```

### Production Checklist

- [ ] Setup managed PostgreSQL for AI service
- [ ] Configure vector database (Pinecone/Weaviate)
- [ ] Set up API key rotation for OpenAI
- [ ] Configure autoscaling based on request volume
- [ ] Setup alerts for high costs
- [ ] Implement request queuing for rate limit handling
- [ ] Add caching for common queries
- [ ] Setup backup strategy for conversations

---

## 💰 Cost Estimation

### OpenAI API Costs (Monthly)

```
Assumptions:
- 1,000 users
- 10 messages per user per day
- Average 100 tokens per message
- GPT-4: $0.03/1K input, $0.06/1K output

Calculation:
1,000 users × 10 messages × 30 days = 300,000 messages/month
300,000 × 100 tokens = 30M tokens
30M tokens × $0.045/1K = $1,350/month

With GPT-3.5-turbo: ~$60/month
```

### Infrastructure Costs

```
AI Service:
- Container: $20/month (2 vCPU, 4GB RAM)
- PostgreSQL: $15/month (managed)
- Vector DB: $0-70/month (depending on provider)

Total: $35-105/month
```

---

## ⚠️ Risks & Mitigation

| Risk                 | Impact | Mitigation                             |
| -------------------- | ------ | -------------------------------------- |
| High OpenAI costs    | High   | Rate limiting, caching, use GPT-3.5    |
| API rate limits      | Medium | Request queuing, fallback models       |
| Service latency      | Medium | Async processing, streaming responses  |
| Token limit exceeded | Low    | Conversation summarization, truncation |
| Service downtime     | Medium | Circuit breaker, graceful degradation  |

---

## 📚 Additional Resources

### Documentation to Create

- [ ] API documentation (OpenAPI spec)
- [ ] Frontend integration guide
- [ ] Prompt engineering guide
- [ ] Cost optimization guide
- [ ] Troubleshooting guide

### Tools & Libraries

- **LLM**: OpenAI, Anthropic Claude, or open-source (Llama)
- **Vector DB**: Pinecone, Weaviate, Qdrant, or Chroma
- **Embeddings**: OpenAI embeddings, Sentence Transformers
- **Monitoring**: Langfuse, Helicone, or custom Prometheus

---

## ✅ Success Criteria

- [ ] AI service deployed and accessible via Caddy
- [ ] Chat API responds within 3 seconds (non-streaming)
- [ ] Conversations persist correctly in database
- [ ] WebSocket streaming works for real-time responses
- [ ] Cost per conversation < $0.05
- [ ] 99.9% uptime
- [ ] Frontend can create and manage conversations
- [ ] Monitoring dashboards show key metrics
- [ ] Documentation complete

---

## 🎓 Learning Resources

- [OpenAI API Documentation](https://platform.openai.com/docs)
- [Langchain Documentation](https://js.langchain.com/docs)
- [Building LLM Applications](https://www.deeplearning.ai/short-courses/)
- [Microservices Patterns](https://microservices.io/patterns/)
- [Socket.IO Documentation](https://socket.io/docs/)

---

**Ready to start? Begin with Week 1, Day 1-2: Infrastructure Setup!**
