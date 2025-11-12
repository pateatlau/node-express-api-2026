# Deployment Checklist

Complete guide for deploying the Todo application with authentication to production.

---

## Pre-Deployment Checklist

### ✅ Security Configuration

- [ ] **Generate Strong JWT Secrets**

  ```bash
  # Generate 32+ character secrets
  openssl rand -base64 32
  openssl rand -base64 32
  ```

  - Update `JWT_ACCESS_SECRET` in production `.env`
  - Update `JWT_REFRESH_SECRET` in production `.env`
  - **Never** use default/development secrets in production
  - **Never** commit secrets to version control

- [ ] **Enable Production Mode**

  ```bash
  NODE_ENV=production
  ```

- [ ] **Enable HTTPS**
  - Obtain SSL/TLS certificate (Let's Encrypt, Cloudflare, etc.)
  - Configure reverse proxy (Nginx, Caddy) for HTTPS
  - Update cookie settings to require secure flag:
    ```javascript
    res.cookie('refreshToken', token, {
      httpOnly: true,
      secure: true, // ✅ Required for production
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    ```

- [ ] **Configure CORS**

  ```bash
  # Production frontend URL
  CORS_ORIGIN=https://yourdomain.com
  ```

  - Update to production domain
  - Remove development URLs
  - Enable credentials: `credentials: true`

- [ ] **Update Database Security**
  - Use strong database password (20+ characters)
  - Restrict database access to application server IP only
  - Enable SSL/TLS for database connections
  - Regular backups configured

- [ ] **Set Secure Session Timeout**
  ```bash
  # Adjust based on your security requirements
  SESSION_TIMEOUT_MINUTES=30  # Longer for production
  ```

---

### ✅ Database Setup

- [ ] **Create Production Database**

  ```bash
  # Create database
  createdb your_production_db

  # Or use managed service (AWS RDS, Heroku Postgres, etc.)
  ```

- [ ] **Update Database URL**

  ```bash
  DATABASE_URL="postgresql://user:password@prod-host:5432/dbname?sslmode=require"
  ```

  - Use `sslmode=require` for production
  - Store credentials securely (environment variables, secrets manager)

- [ ] **Run Migrations**

  ```bash
  npx prisma migrate deploy
  ```

  - Use `migrate deploy` (not `migrate dev`) for production
  - Test on staging environment first

- [ ] **Verify Database Connection**

  ```bash
  npx prisma db pull
  ```

- [ ] **Setup Database Backups**
  - Configure automated daily backups
  - Test backup restoration process
  - Store backups in separate location

---

### ✅ Environment Variables

#### Backend Environment Variables

Create production `.env` file:

```bash
# Database
DATABASE_URL="postgresql://user:pass@host:5432/dbname?sslmode=require"

# Server
PORT=4000
NODE_ENV=production

# CORS - Your production frontend URL
CORS_ORIGIN=https://yourdomain.com

# JWT Secrets - MUST BE DIFFERENT FROM DEVELOPMENT
JWT_ACCESS_SECRET="<generated-secure-secret-32+-chars>"
JWT_REFRESH_SECRET="<generated-secure-secret-32+-chars>"

# Session
SESSION_TIMEOUT_MINUTES=30

# Logging
LOG_LEVEL=info

# Optional: Error Tracking
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project
```

#### Frontend Environment Variables

Create `.env.production`:

```bash
# Production API URL
VITE_API_URL=https://api.yourdomain.com

# GraphQL Endpoints
VITE_GRAPHQL_HTTP_URL=https://api.yourdomain.com/graphql
VITE_GRAPHQL_WS_URL=wss://api.yourdomain.com/graphql
```

**Important**:

- Use `wss://` (not `ws://`) for WebSocket over HTTPS
- Use `https://` (not `http://`) for all HTTP endpoints

---

### ✅ Code Changes for Production

- [ ] **Update Axios Client**

  ```typescript
  // lib/api/client.ts
  const client = axios.create({
    baseURL: import.meta.env.VITE_API_URL,
    withCredentials: true,
    timeout: 30000, // 30 second timeout
  });
  ```

- [ ] **Remove Development Tools**

  ```tsx
  // Remove or conditionally render
  {
    import.meta.env.DEV && <ReactQueryDevtools />;
  }
  ```

- [ ] **Remove Debug Logs**

  ```typescript
  // Remove console.log statements
  // Or use proper logger that respects LOG_LEVEL
  ```

- [ ] **Optimize Bundle Size**

  ```bash
  # Frontend build
  npm run build

  # Check bundle size
  npm run preview
  ```

---

### ✅ Rate Limiting for Production

- [ ] **Adjust Rate Limits** (backend)

  ```typescript
  // middleware/rateLimiter.ts
  export const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000, // Higher for production traffic
    // ... other options
  });
  ```

- [ ] **Consider Using Redis for Rate Limiting**

  ```bash
  npm install rate-limit-redis redis
  ```

  ```typescript
  import RedisStore from 'rate-limit-redis';
  import { createClient } from 'redis';

  const client = createClient({ url: process.env.REDIS_URL });

  export const apiLimiter = rateLimit({
    store: new RedisStore({
      client,
      prefix: 'rl:',
    }),
    windowMs: 15 * 60 * 1000,
    max: 1000,
  });
  ```

---

## Deployment Steps

### Option 1: Deploy to Platform as a Service (PaaS)

#### Heroku

**Backend**:

```bash
# Login to Heroku
heroku login

# Create app
heroku create your-app-api

# Add PostgreSQL
heroku addons:create heroku-postgresql:hobby-dev

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set JWT_ACCESS_SECRET="your-secret"
heroku config:set JWT_REFRESH_SECRET="your-secret"
heroku config:set CORS_ORIGIN="https://your-app.vercel.app"
heroku config:set SESSION_TIMEOUT_MINUTES=30

# Deploy
git push heroku main

# Run migrations
heroku run npx prisma migrate deploy

# Check logs
heroku logs --tail
```

**Frontend**:

```bash
# Deploy to Vercel, Netlify, or similar
# Example: Vercel
vercel --prod

# Set environment variables in Vercel dashboard
# VITE_API_URL=https://your-app-api.herokuapp.com
# VITE_GRAPHQL_HTTP_URL=https://your-app-api.herokuapp.com/graphql
# VITE_GRAPHQL_WS_URL=wss://your-app-api.herokuapp.com/graphql
```

---

#### Railway

**Backend**:

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Create project
railway init

# Add PostgreSQL
railway add postgresql

# Deploy
railway up

# Set environment variables via Railway dashboard
```

---

#### Render

**Backend**:

1. Connect GitHub repository
2. Select "Web Service"
3. Set build command: `npm install && npx prisma generate`
4. Set start command: `npm start`
5. Add environment variables in dashboard
6. Add PostgreSQL database
7. Deploy

**Frontend**:

1. Select "Static Site"
2. Set build command: `npm run build`
3. Set publish directory: `dist`
4. Add environment variables
5. Deploy

---

### Option 2: Deploy to VPS (Virtual Private Server)

#### Server Setup

```bash
# SSH into server
ssh user@your-server-ip

# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL
sudo apt install postgresql postgresql-contrib

# Install Nginx
sudo apt install nginx

# Install PM2 (process manager)
sudo npm install -g pm2
```

---

#### Deploy Backend

```bash
# Clone repository
git clone https://github.com/your-repo/backend.git
cd backend

# Install dependencies
npm install

# Create .env file
nano .env
# Paste production environment variables

# Generate Prisma Client
npx prisma generate

# Run migrations
npx prisma migrate deploy

# Build TypeScript
npm run build

# Start with PM2
pm2 start dist/index.js --name "todo-api"
pm2 save
pm2 startup
```

---

#### Configure Nginx (Backend)

```nginx
# /etc/nginx/sites-available/api.yourdomain.com

server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket support for GraphQL subscriptions
    location /graphql {
        proxy_pass http://localhost:4000/graphql;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/api.yourdomain.com /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Setup SSL with Let's Encrypt
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d api.yourdomain.com
```

---

#### Deploy Frontend

```bash
# Build locally or on server
npm run build

# Upload dist/ folder to server
scp -r dist/* user@server:/var/www/yourdomain.com/
```

#### Configure Nginx (Frontend)

```nginx
# /etc/nginx/sites-available/yourdomain.com

server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    root /var/www/yourdomain.com;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

```bash
# Enable site and SSL
sudo ln -s /etc/nginx/sites-available/yourdomain.com /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

---

## Post-Deployment Verification

### ✅ Backend Health Checks

- [ ] **API is accessible**

  ```bash
  curl https://api.yourdomain.com/api/auth/session
  # Should return 401 (not authenticated) - this is correct
  ```

- [ ] **Database connection working**

  ```bash
  # Check backend logs
  pm2 logs todo-api
  # Look for "Connected to PostgreSQL"
  ```

- [ ] **CORS configured correctly**

  ```bash
  curl -H "Origin: https://yourdomain.com" \
       -H "Access-Control-Request-Method: POST" \
       -X OPTIONS \
       https://api.yourdomain.com/api/auth/login
  # Should return Access-Control-Allow-Origin header
  ```

- [ ] **HTTPS working** (no mixed content warnings)
- [ ] **WebSocket connection working** (GraphQL subscriptions)
- [ ] **Rate limiting active** (test with multiple requests)

---

### ✅ Frontend Verification

- [ ] **Application loads**
  - Visit https://yourdomain.com
  - Check console for errors

- [ ] **API calls working**
  - Try signup/login
  - Check Network tab for successful requests
  - Verify requests go to HTTPS endpoints

- [ ] **Authentication flow**
  - Signup → Login → Access protected routes → Logout

- [ ] **Session management**
  - Warning at 1 minute remaining
  - Auto-logout after timeout

- [ ] **Role-based access**
  - STARTER user: No GraphQL access
  - PRO user: Full access

- [ ] **GraphQL working** (PRO users)
  - Navigate to /graphql
  - Verify queries return data
  - Check WebSocket connection (wss://)

---

## Monitoring & Logging

### ✅ Setup Error Tracking

**Sentry Integration**:

```bash
# Backend
npm install @sentry/node

# Frontend
npm install @sentry/react
```

```typescript
// Backend - src/config/sentry.ts
import * as Sentry from '@sentry/node';

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
  });
}

// Frontend - src/main.tsx
import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  integrations: [new Sentry.BrowserTracing()],
  tracesSampleRate: 0.1,
});
```

---

### ✅ Setup Logging

**Winston Logger** (Backend):

```typescript
// Already configured in src/config/logger.ts
// Set LOG_LEVEL=info in production
```

**Monitor Logs**:

```bash
# PM2 logs
pm2 logs todo-api

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# System logs
journalctl -u nginx -f
```

---

### ✅ Setup Monitoring

**Health Check Endpoint**:

```typescript
// backend/src/routes/health.ts
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});
```

**Uptime Monitoring**:

- Setup monitoring with UptimeRobot, Pingdom, or similar
- Monitor `/health` endpoint
- Alert on downtime

---

## Security Best Practices

- [ ] **Rate Limiting**: Verify limits are appropriate for production
- [ ] **Input Validation**: All endpoints validate input (Zod schemas)
- [ ] **SQL Injection**: Using Prisma (ORM) - protected
- [ ] **XSS Protection**: React escapes output by default - protected
- [ ] **CSRF Protection**: Using httpOnly cookies + sameSite
- [ ] **Password Hashing**: bcrypt with 12 rounds minimum
- [ ] **JWT Best Practices**: Short-lived access tokens (15 min)
- [ ] **HTTPS Only**: All production traffic over HTTPS
- [ ] **Security Headers**: Add helmet.js middleware
  ```bash
  npm install helmet
  ```
  ```typescript
  import helmet from 'helmet';
  app.use(helmet());
  ```

---

## Backup & Disaster Recovery

- [ ] **Database Backups**
  - Automated daily backups
  - Test restore process monthly
  - Store backups in different region

- [ ] **Code Backups**
  - Git repository (GitHub, GitLab)
  - Tagged releases for each deployment

- [ ] **Environment Variables**
  - Securely backup `.env` files
  - Use secrets manager (AWS Secrets Manager, HashiCorp Vault)

- [ ] **Recovery Plan**
  - Document recovery steps
  - Keep emergency contacts list
  - Test disaster recovery quarterly

---

## Performance Optimization

- [ ] **Database Indexing**
  - Indexes on `email`, `role` (already configured)
  - Monitor slow queries

- [ ] **Caching**
  - Consider Redis for session storage
  - Cache GraphQL queries (Apollo Client)
  - CDN for frontend assets

- [ ] **Compression**
  - Enable gzip in Nginx
  - Backend compression middleware (already configured)

- [ ] **Connection Pooling**
  - Prisma handles this automatically
  - Adjust pool size if needed

---

## Continuous Integration / Deployment (CI/CD)

**GitHub Actions Example**:

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test

      - name: Build
        run: npm run build

      - name: Deploy to production
        # Add your deployment commands here
        run: |
          # Deploy to Heroku, Railway, Render, etc.
```

---

## Final Checklist

Before going live:

- [ ] All environment variables set correctly
- [ ] Database migrations applied
- [ ] HTTPS configured with valid SSL certificate
- [ ] CORS configured for production domain
- [ ] Rate limiting appropriate for expected traffic
- [ ] Error tracking (Sentry) configured
- [ ] Monitoring and alerts setup
- [ ] Backup system tested and working
- [ ] Performance tested (load testing if high traffic expected)
- [ ] Security audit completed
- [ ] Documentation updated (README, API docs)
- [ ] Team notified of deployment
- [ ] Rollback plan prepared

---

## Rollback Plan

If issues arise after deployment:

```bash
# Backend rollback
pm2 stop todo-api
cd backend
git checkout <previous-commit-hash>
npm install
npm run build
pm2 restart todo-api

# Frontend rollback
# Re-deploy previous build
# Or use platform's rollback feature
```

---

## Support Contacts

- **Technical Lead**: [name@email.com]
- **DevOps**: [devops@email.com]
- **On-Call**: [+1-xxx-xxx-xxxx]

---

## Additional Resources

- [API Documentation](./API.md)
- [Troubleshooting Guide](./TROUBLESHOOTING.md)
- [README](../README.md)
- [Prisma Deployment Guide](https://www.prisma.io/docs/guides/deployment)
- [Node.js Production Best Practices](https://nodejs.org/en/docs/guides/nodejs-docker-webapp/)

---

**Remember**: Always test in a staging environment before deploying to production!
