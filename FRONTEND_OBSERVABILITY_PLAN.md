# Frontend Observability Plan

## 🎯 Overview

Frontend observability requires different tools and metrics than backend. Users experience issues that backend metrics won't capture: slow page loads, client-side errors, network failures, poor user experience.

---

## 🤔 Implementation Strategy: Together or Separate?

### **Recommendation: Together (Integrated Approach) ✅**

**Why?**

1. **End-to-End Visibility** - See complete user journey from frontend → backend
2. **Correlated Debugging** - Link frontend errors to backend traces
3. **Shared Infrastructure** - Reuse Grafana, alert channels
4. **Cost Efficient** - Single observability platform
5. **Consistent Experience** - One place to debug all issues

**Timeline:**

- Backend observability: Week 1-2
- Frontend observability: Week 2-3 (overlap with backend Week 2)
- **Total: 3 weeks** (with 1 week overlap)

---

## 📊 Frontend Observability Stack

### **The Three Pillars (Frontend Edition)**

```
┌─────────────────────────────────────────────────────────────────┐
│               FRONTEND OBSERVABILITY STACK                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │   METRICS   │  │   TRACES    │  │    LOGS     │            │
│  │             │  │             │  │             │            │
│  │  Faro/RUM   │  │  Faro/RUM   │  │  Faro/RUM   │            │
│  │             │  │             │  │             │            │
│  │ • Page Load │  │ • Resource  │  │ • Errors    │            │
│  │ • Web Vitals│  │ • API Calls │  │ • Console   │            │
│  │ • User Flow │  │ • Timeline  │  │ • Custom    │            │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘            │
│         │                 │                 │                   │
│         └─────────────────┼─────────────────┘                   │
│                           │                                     │
│                    ┌──────▼──────┐                              │
│                    │             │                              │
│                    │   Grafana   │ ◄─── Shared with Backend    │
│                    │             │                              │
│                    │ • Dashboards│                              │
│                    │ • Alerts    │                              │
│                    │ • Visualize │                              │
│                    └─────────────┘                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

PLUS:
┌───────────────────────────────────────┐
│   SESSION REPLAY (Optional)           │
│                                       │
│   • LogRocket / FullStory / Sentry   │
│   • Watch user sessions               │
│   • Debug UI issues                   │
│   • Understand user behavior          │
└───────────────────────────────────────┘
```

---

## 🛠️ Tool Comparison

### **Option 1: Grafana Faro (FREE) ✅ RECOMMENDED**

**Pros:**

- ✅ FREE and open source
- ✅ Integrates perfectly with existing Grafana stack
- ✅ Real User Monitoring (RUM)
- ✅ Web Vitals (Core Web Vitals)
- ✅ Error tracking
- ✅ Performance monitoring
- ✅ Traces link to backend Jaeger/Tempo
- ✅ Self-hosted (data privacy)

**Cons:**

- ⚠️ No session replay (need separate tool)
- ⚠️ Less mature than commercial options
- ⚠️ Manual dashboard setup

**Cost:** $0 (self-hosted)

**Best for:** Our use case (already using Grafana, want cost control)

---

### **Option 2: Sentry (FREEMIUM)**

**Pros:**

- ✅ Excellent error tracking
- ✅ Automatic source map upload
- ✅ Issue grouping and deduplication
- ✅ Performance monitoring
- ✅ Session replay (paid tier)
- ✅ Great DX (developer experience)
- ✅ Integrates with backend (Node.js SDK)

**Cons:**

- ⚠️ Free tier: 5k errors/month, 10k transactions/month
- ⚠️ Paid: $26/month + usage ($0.00045/error, $0.00012/transaction)
- ⚠️ Can get expensive at scale
- ⚠️ Data sent to Sentry cloud

**Cost:** $0-$100/month (depending on traffic)

**Best for:** Teams wanting battle-tested error tracking

---

### **Option 3: LogRocket (PREMIUM)**

**Pros:**

- ✅ Session replay (video-like recordings)
- ✅ Console logs, network, Redux/Vuex state
- ✅ Heatmaps and click tracking
- ✅ Performance monitoring
- ✅ Integration with error tracking

**Cons:**

- ⚠️ Expensive: $99/month (dev plan), $299/month (team)
- ⚠️ Privacy concerns (records everything)
- ⚠️ Performance impact (large bundle size)

**Cost:** $99-$299/month

**Best for:** Product teams needing to understand user behavior

---

### **Option 4: DataDog RUM (ENTERPRISE)**

**Pros:**

- ✅ Enterprise-grade
- ✅ Full-stack observability
- ✅ Powerful querying and analytics
- ✅ Session replay
- ✅ Integrates with backend DataDog

**Cons:**

- ⚠️ Very expensive: $1.27 per 1,000 sessions
- ⚠️ Complex setup
- ⚠️ Overkill for most projects

**Cost:** $500-$5,000+/month

**Best for:** Large enterprises with deep pockets

---

## 📝 Recommended Stack: Grafana Faro + Sentry (Hybrid)

### **Why Hybrid?**

Use **Grafana Faro** for performance monitoring and **Sentry** for error tracking:

1. **Faro (FREE)** - RUM, Web Vitals, performance, traces
2. **Sentry (FREE tier)** - Error tracking, source maps, issue grouping
3. **Grafana (existing)** - Unified dashboards for frontend + backend
4. **Optional: LogRocket** - Add later if need session replay

**Total Cost:** $0-$26/month (depending on Sentry usage)

---

## 🗓️ Implementation Timeline

### **Week 2 (Overlaps with Backend Week 2)**

#### **Day 1: Grafana Faro Setup (2-3 hours)**

**Morning:**

- [ ] Add Faro collector to docker-compose
- [ ] Install Faro Web SDK in React app
- [ ] Configure Faro in frontend
- [ ] Test basic instrumentation

**Afternoon:**

- [ ] Add Web Vitals instrumentation
- [ ] Configure performance monitoring
- [ ] Test data flow to Grafana

---

#### **Day 2: Sentry Setup (2-3 hours)**

**Morning:**

- [ ] Create Sentry account (free tier)
- [ ] Install Sentry SDK in React app
- [ ] Configure source maps upload
- [ ] Test error capture

**Afternoon:**

- [ ] Add error boundaries
- [ ] Configure performance monitoring
- [ ] Test integration with backend Sentry

---

#### **Day 3: Frontend Dashboards (3-4 hours)**

**Morning:**

- [ ] Create Web Vitals dashboard
- [ ] Create Error tracking dashboard
- [ ] Create User journey dashboard

**Afternoon:**

- [ ] Create Performance dashboard
- [ ] Add resource timing metrics
- [ ] Configure dashboard variables

---

### **Week 3**

#### **Day 1: Custom Instrumentation (3-4 hours)**

**Morning:**

- [ ] Add custom metrics (button clicks, form submissions)
- [ ] Track user flows (login → dashboard → todos)
- [ ] Add business event tracking

**Afternoon:**

- [ ] Add console log forwarding
- [ ] Add network error tracking
- [ ] Test custom instrumentation

---

#### **Day 2: Alerting & Error Handling (2-3 hours)**

**Morning:**

- [ ] Configure frontend alerts (error rate, page load)
- [ ] Setup Sentry alert rules
- [ ] Test alert delivery

**Afternoon:**

- [ ] Improve error boundaries
- [ ] Add user-facing error messages
- [ ] Test error recovery flows

---

#### **Day 3: End-to-End Tracing (3-4 hours)**

**Morning:**

- [ ] Link frontend traces to backend Jaeger
- [ ] Configure trace context propagation
- [ ] Test distributed tracing

**Afternoon:**

- [ ] Create E2E journey dashboard
- [ ] Visualize full request flow (browser → Caddy → backend → database)
- [ ] Document trace correlation

---

#### **Day 4: Optimization & Baselines (3-4 hours)**

**Morning:**

- [ ] Run Lighthouse audits
- [ ] Document Web Vitals baselines
- [ ] Identify performance bottlenecks

**Afternoon:**

- [ ] Optimize bundle size
- [ ] Optimize images/assets
- [ ] Re-test and verify improvements

---

#### **Day 5: Documentation & Training (2-3 hours)**

**Morning:**

- [ ] Write frontend observability guide
- [ ] Document dashboard usage
- [ ] Create troubleshooting runbook

**Afternoon:**

- [ ] Team training session
- [ ] Demo dashboards and tools
- [ ] Answer questions

---

## 📦 Implementation Details

### **1. Grafana Faro Setup**

**docker-compose.caddy.yml additions:**

```yaml
services:
  faro-collector:
    image: grafana/faro-collector:latest
    container_name: faro-collector
    ports:
      - '12347:12347'
    environment:
      - FARO_RECEIVER_ENABLED=true
      - FARO_METRICS_STORAGE_TYPE=prometheus
      - FARO_METRICS_STORAGE_PROMETHEUS_URL=http://prometheus:9090
      - FARO_LOGS_STORAGE_TYPE=loki
      - FARO_LOGS_STORAGE_LOKI_URL=http://loki:3100
      - FARO_TRACES_STORAGE_TYPE=jaeger
      - FARO_TRACES_STORAGE_JAEGER_URL=http://jaeger:14268
    networks:
      - caddy-network
    restart: unless-stopped
```

**Update Caddyfile to allow CORS:**

```
:8080 {
    # Allow Faro collector requests
    @faro {
        path /faro/*
    }
    reverse_proxy @faro faro-collector:12347

    # Rest of config...
}
```

**Install Faro SDK (frontend):**

```bash
cd /Users/patea/2026/projects/react-stack-2026
npm install @grafana/faro-web-sdk @grafana/faro-web-tracing @grafana/faro-react
```

**src/utils/faro.ts (new file):**

```typescript
import { initializeFaro, getWebInstrumentations } from '@grafana/faro-web-sdk';
import { TracingInstrumentation } from '@grafana/faro-web-tracing';
import { ReactIntegration } from '@grafana/faro-react';

export const faro = initializeFaro({
  url: 'http://localhost:8080/faro/collect',
  app: {
    name: 'todo-frontend',
    version: '1.0.0',
    environment: import.meta.env.MODE || 'development',
  },
  instrumentations: [
    ...getWebInstrumentations({
      captureConsole: true,
      captureConsoleDisabledLevels: [], // Capture all console levels
    }),
    new TracingInstrumentation(),
    new ReactIntegration(),
  ],
  batching: {
    enabled: true,
    sendTimeout: 5000, // Send every 5 seconds
  },
  dedupe: true, // Deduplicate identical events
  beforeSend: (item) => {
    // Filter sensitive data
    if (item.type === 'log' && item.payload?.message?.includes('password')) {
      return null; // Don't send
    }
    return item;
  },
});
```

**src/main.tsx:**

```typescript
import { faro } from './utils/faro';

// Initialize Faro before React
if (import.meta.env.PROD || import.meta.env.VITE_ENABLE_FARO === 'true') {
  console.log('🔍 Faro initialized');
}

// Rest of your app...
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

**Track Web Vitals:**

```typescript
import { faro } from './utils/faro';

// Web Vitals are automatically tracked by Faro
// But you can add custom business metrics:

export const trackUserAction = (action: string, metadata?: any) => {
  faro.api.pushEvent('user_action', {
    action,
    ...metadata,
  });
};

export const trackBusinessEvent = (event: string, value?: number) => {
  faro.api.pushMeasurement({
    type: 'custom',
    values: {
      [event]: value || 1,
    },
  });
};

// Usage examples:
trackUserAction('todo_created', { todoId: '123', priority: 'high' });
trackUserAction('login_success', { method: 'email' });
trackBusinessEvent('todo_completion', 1);
```

---

### **2. Sentry Setup**

**Create Sentry project:**

1. Go to https://sentry.io
2. Create free account
3. Create project: React + Vite
4. Copy DSN

**Install Sentry SDK:**

```bash
npm install @sentry/react @sentry/vite-plugin
```

**vite.config.ts:**

```typescript
import { sentryVitePlugin } from '@sentry/vite-plugin';

export default defineConfig({
  plugins: [
    react(),
    // Add Sentry plugin for source maps
    sentryVitePlugin({
      org: 'your-org',
      project: 'todo-frontend',
      authToken: process.env.SENTRY_AUTH_TOKEN,
      sourcemaps: {
        assets: './dist/**',
      },
    }),
  ],
  build: {
    sourcemap: true, // Enable source maps for production
  },
});
```

**src/utils/sentry.ts (new file):**

```typescript
import * as Sentry from '@sentry/react';
import { BrowserTracing } from '@sentry/tracing';

export function initSentry() {
  if (import.meta.env.PROD || import.meta.env.VITE_ENABLE_SENTRY === 'true') {
    Sentry.init({
      dsn: import.meta.env.VITE_SENTRY_DSN,
      environment: import.meta.env.MODE,
      release: import.meta.env.VITE_APP_VERSION || '1.0.0',

      // Performance Monitoring
      integrations: [
        new BrowserTracing({
          tracePropagationTargets: ['localhost', /^https:\/\/yourapi\.com\/api/],
        }),
      ],
      tracesSampleRate: 1.0, // 100% in dev, reduce to 0.1 (10%) in production

      // Error tracking
      beforeSend(event, hint) {
        // Filter sensitive data
        if (event.request?.data) {
          event.request.data = filterSensitiveData(event.request.data);
        }
        return event;
      },

      // Ignore known errors
      ignoreErrors: ['ResizeObserver loop limit exceeded', 'Non-Error promise rejection captured'],
    });
  }
}

function filterSensitiveData(data: any) {
  if (typeof data === 'object') {
    const filtered = { ...data };
    if (filtered.password) filtered.password = '[REDACTED]';
    if (filtered.token) filtered.token = '[REDACTED]';
    return filtered;
  }
  return data;
}
```

**src/main.tsx:**

```typescript
import { initSentry } from './utils/sentry';

// Initialize Sentry before React
initSentry();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={<ErrorFallback />} showDialog>
      <App />
    </Sentry.ErrorBoundary>
  </React.StrictMode>
);
```

**Error Boundary Component:**

```typescript
import * as Sentry from '@sentry/react';

function ErrorFallback({ error, resetError }: any) {
  return (
    <div className="error-fallback">
      <h2>Something went wrong</h2>
      <p>{error?.message}</p>
      <button onClick={resetError}>Try again</button>
      <button onClick={() => Sentry.showReportDialog()}>
        Report feedback
      </button>
    </div>
  );
}
```

**Track custom errors:**

```typescript
try {
  await createTodo(data);
} catch (error) {
  Sentry.captureException(error, {
    tags: {
      section: 'todos',
      action: 'create',
    },
    extra: {
      todoData: data,
      userId: user.id,
    },
  });
  throw error;
}
```

---

### **3. Frontend Dashboards**

**Web Vitals Dashboard (Grafana):**

Panels:

- **LCP (Largest Contentful Paint)** - Should be < 2.5s
- **FID (First Input Delay)** - Should be < 100ms
- **CLS (Cumulative Layout Shift)** - Should be < 0.1
- **TTFB (Time to First Byte)** - Should be < 600ms
- **FCP (First Contentful Paint)** - Should be < 1.8s

**Performance Dashboard:**

Panels:

- **Page Load Time** (p50, p95, p99)
- **Resource Load Times** (JS, CSS, images)
- **API Call Duration** (by endpoint)
- **Bundle Size Over Time**
- **Cache Hit Rate**

**Error Dashboard:**

Panels:

- **Error Rate** (errors per minute)
- **Error Types** (pie chart: JS, network, API)
- **Top Errors** (by count)
- **Errors by Page** (which pages have most errors)
- **Error Trends** (over time)

**User Journey Dashboard:**

Panels:

- **Page Views** (by route)
- **User Flow** (sankey diagram: login → dashboard → todos)
- **Time on Page** (engagement)
- **Bounce Rate** (users leaving immediately)
- **Conversion Funnel** (signup → first todo → active user)

---

## 📊 Key Metrics to Track

### **Web Vitals (Core)**

- ✅ LCP (Largest Contentful Paint) - Loading performance
- ✅ FID (First Input Delay) - Interactivity
- ✅ CLS (Cumulative Layout Shift) - Visual stability

### **Performance Metrics**

- ✅ TTFB (Time to First Byte)
- ✅ FCP (First Contentful Paint)
- ✅ TTI (Time to Interactive)
- ✅ TBT (Total Blocking Time)
- ✅ Bundle Size
- ✅ Resource Load Times

### **Error Metrics**

- ✅ JavaScript Errors (count, rate)
- ✅ Network Errors (failed API calls)
- ✅ Console Errors/Warnings
- ✅ Unhandled Promise Rejections

### **Business Metrics**

- ✅ User Actions (clicks, form submissions)
- ✅ Feature Usage (which features are used most)
- ✅ User Flows (successful vs failed journeys)
- ✅ Conversion Rates

### **User Experience**

- ✅ Page Views by Route
- ✅ Time on Page
- ✅ Bounce Rate
- ✅ Browser/Device Distribution
- ✅ Geographic Distribution

---

## 🔗 End-to-End Tracing

### **Link Frontend to Backend Traces**

**Frontend (propagate trace context):**

```typescript
import { faro } from './utils/faro';

// Automatically adds trace headers to fetch requests
fetch('http://localhost:8080/api/todos', {
  headers: {
    Authorization: `Bearer ${token}`,
    // Faro automatically adds:
    // 'traceparent': '00-trace-id-span-id-01'
    // 'tracestate': 'vendor=faro'
  },
});
```

**Backend (extract trace context):**

```typescript
// OpenTelemetry automatically extracts trace headers
// and links frontend → backend traces

// Your traces will show:
// Frontend Request → API Gateway (Caddy) → Backend → Database
```

**Visualize in Grafana:**

```
User clicks "Create Todo"
  ↓ [Frontend: 45ms]
  ├─ React event handler (5ms)
  ├─ Form validation (2ms)
  └─ Fetch API call (38ms)
      ↓ [Network: 15ms]
      ↓ [Caddy: 2ms]
      ↓ [Backend: 125ms]
      ├─ Authentication middleware (5ms)
      ├─ Rate limiter (1ms)
      ├─ Controller (3ms)
      └─ Database query (116ms) ← BOTTLENECK!
```

---

## 🚨 Frontend Alerts

**Alert Rules:**

1. **High Error Rate**
   - Condition: Error rate > 5% for 5 minutes
   - Severity: Warning
   - Channel: Slack

2. **Poor Web Vitals**
   - Condition: LCP > 4s for 10 minutes
   - Severity: Warning
   - Channel: Slack

3. **API Failure Rate**
   - Condition: Failed API calls > 10% for 5 minutes
   - Severity: Critical
   - Channel: Slack + Email

4. **Page Load Slow**
   - Condition: p95 page load > 5s for 10 minutes
   - Severity: Warning
   - Channel: Slack

---

## ✅ Success Criteria

- [ ] Faro collecting RUM data from production
- [ ] Web Vitals tracked and visualized
- [ ] Sentry capturing errors with source maps
- [ ] Frontend dashboards in Grafana
- [ ] End-to-end traces linking frontend → backend
- [ ] Alerts configured for critical issues
- [ ] Web Vitals baselines documented
- [ ] Team trained on frontend observability

---

## 💰 Cost Comparison

### **Option A: Faro + Sentry Free (RECOMMENDED)**

```
Faro: $0 (self-hosted)
Sentry Free: $0 (5k errors, 10k transactions/month)
Total: $0/month

Good for: 10,000 users/month
```

### **Option B: Faro + Sentry Paid**

```
Faro: $0
Sentry Team: $26/month + usage
Total: $26-100/month

Good for: 50,000 users/month
```

### **Option C: LogRocket + Sentry**

```
LogRocket Dev: $99/month
Sentry Team: $26/month
Total: $125/month

Good for: Teams needing session replay
```

### **Option D: DataDog RUM (Enterprise)**

```
DataDog RUM: $1.27 per 1,000 sessions
10,000 sessions/month = $127/month
50,000 sessions/month = $635/month
Total: $127-635/month

Good for: Large enterprises
```

---

## 📝 Recommendation

### **Phase 1: Free Tier (Start Here) ✅**

**Tools:**

- Grafana Faro (FREE) - RUM, Web Vitals, performance
- Sentry Free (FREE) - Error tracking, 5k errors/month
- Grafana (existing) - Dashboards, alerts

**Timeline:** Week 2-3 (overlap with backend Week 2)  
**Cost:** $0  
**Effort:** ~40 hours (1 week for 1 person)

**When to use:**

- ✅ You're already using Grafana (we are!)
- ✅ You want to keep costs low
- ✅ You need basic error tracking and RUM
- ✅ You have < 5k errors/month and < 10k page loads/month

---

### **Phase 2: Upgrade Later (If Needed)**

**Add when:**

- Sentry free tier exceeded → Upgrade to Sentry Team ($26/month)
- Need session replay → Add LogRocket ($99/month)
- Need advanced analytics → Add Mixpanel/Amplitude (free tier available)

---

## 🚀 Integrated Timeline: Backend + Frontend

### **Week 1: Backend Core** (Day 1-5)

- Prometheus, Grafana, Jaeger, Loki
- Backend metrics, dashboards, tracing

### **Week 2: Backend Polish + Frontend Start** (Day 6-10)

- **Days 1-3**: Backend alerting, load testing, exporters
- **Days 4-5**: Frontend Faro + Sentry setup ← **START FRONTEND**

### **Week 3: Frontend Complete** (Day 11-15)

- **Days 1-2**: Frontend dashboards, custom instrumentation
- **Day 3**: End-to-end tracing (frontend → backend)
- **Day 4**: Optimization, baselines
- **Day 5**: Documentation, training

**Total: 3 weeks with 3 days overlap**

---

## 🎯 Next Steps

1. **Complete backend observability** (Week 1-2)
2. **Start frontend observability** (Week 2-3, overlap on Week 2)
3. **Link frontend to backend traces** (Week 3, Day 3)
4. **Establish baselines for both** (Week 3, Day 4)
5. **Proceed with microservices migration** (Week 4+)

---

**Ready to implement?** Let's start with backend Day 1, then add frontend in Week 2! 🚀
