# Caddy Configuration Files

This directory contains Caddy reverse proxy configurations for development and production environments.

## 📁 Files

### `Caddyfile.dev`

- **Purpose**: Development environment (local testing)
- **Domain**: `localhost:8080`
- **HTTPS**: Disabled (HTTP only)
- **SSL**: No SSL certificates needed
- **Usage**: Local development and testing

### `Caddyfile.prod`

- **Purpose**: Production environment
- **Domain**: `api.yourdomain.com` (replace with your domain)
- **HTTPS**: ✅ Automatic (Let's Encrypt)
- **SSL**: Auto-provisioned and auto-renewed
- **Usage**: Production deployment

## 🚀 Quick Start

### Development (localhost)

```bash
# Start Caddy with development config
docker run -d \
  --name caddy-dev \
  -p 80:80 -p 8080:8080 -p 2019:2019 \
  -v $PWD/Caddyfile.dev:/etc/caddy/Caddyfile \
  -v $PWD/../logs:/var/log/caddy \
  --network todo-network \
  caddy:2.7-alpine

# Test
curl http://localhost:8080/health
```

### Production (with automatic HTTPS)

```bash
# IMPORTANT: First update Caddyfile.prod:
# 1. Replace api.yourdomain.com with your actual domain
# 2. Replace your-email@example.com with your email
# 3. Ensure DNS A record points to your server

# Start Caddy with production config
docker run -d \
  --name caddy-prod \
  -p 80:80 -p 443:443 -p 443:443/udp \
  -v $PWD/Caddyfile.prod:/etc/caddy/Caddyfile \
  -v caddy_data:/data \
  -v caddy_config:/config \
  -v $PWD/../logs:/var/log/caddy \
  --network todo-network \
  caddy:2.7-alpine

# Watch logs for SSL certificate acquisition (1-2 minutes)
docker logs -f caddy-prod

# Expected log:
# "certificate obtained successfully"
# "serving https"

# Test
curl https://api.yourdomain.com/health
```

## ⚙️ Configuration Overview

### Load Balancing

Both configurations load balance across 3 backend instances:

- `backend-1:4001`
- `backend-2:4002`
- `backend-3:4003`

**Strategies:**

- **Most endpoints**: `least_conn` (route to backend with fewest connections)
- **WebSocket**: `ip_hash` (sticky sessions - same client → same backend)

### Health Checks

All backends are monitored:

- **Endpoint**: `/health`
- **Interval**: 10s (dev), 30s (prod)
- **Timeout**: 5s (dev), 10s (prod)
- **Max Failures**: 3
- **Recovery Time**: 30s

If a backend fails health checks, traffic is automatically routed to healthy instances.

### Endpoints Configuration

#### `/health` - Health Check

- **Caching**: ❌ No
- **Load Balancing**: least_conn
- **Purpose**: Load balancer health checks

#### `/socket.io/*` - WebSocket

- **Caching**: ❌ No (not applicable)
- **Load Balancing**: ip_hash (sticky sessions)
- **Timeouts**: 7 days (persistent connections)

#### `/api/*` - REST API

- **Caching**: Configurable (not in basic config)
- **Load Balancing**: least_conn
- **Timeouts**: 60s

#### `/graphql` - GraphQL

- **Caching**: Configurable (not in basic config)
- **Load Balancing**: least_conn
- **Timeouts**: 120s (longer for complex queries)

## 🔒 Security Headers

### Development

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`

### Production (additional)

- `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload` (HSTS)
- `Content-Security-Policy: ...` (CSP)
- Server header removed

## 📊 Monitoring

### Admin API

Access Caddy's admin API at `http://localhost:2019`

```bash
# Get configuration
curl http://localhost:2019/config/

# Get reverse proxy stats
curl http://localhost:2019/config/apps/http/servers

# Get current upstreams
curl http://localhost:2019/config/apps/http/servers/srv0
```

### Logs

Logs are written to `../logs/`:

- `access.log` - All requests (JSON format)
- `localhost.log` (dev) or `api.log` (prod) - Site-specific logs

```bash
# Tail logs
tail -f ../logs/access.log | jq

# Filter for errors
tail -f ../logs/access.log | jq 'select(.level == "error")'

# Filter for slow requests (>500ms)
tail -f ../logs/access.log | jq 'select(.duration > 0.5)'
```

## 🧪 Testing Configuration

### Validate Syntax

```bash
# Validate development config
docker run --rm \
  -v $PWD/Caddyfile.dev:/etc/caddy/Caddyfile \
  caddy:2.7-alpine \
  caddy validate --config /etc/caddy/Caddyfile

# Expected: "Valid configuration"

# Validate production config
docker run --rm \
  -v $PWD/Caddyfile.prod:/etc/caddy/Caddyfile \
  caddy:2.7-alpine \
  caddy validate --config /etc/caddy/Caddyfile
```

### Test Endpoints

```bash
# Development
curl http://localhost:8080/caddy-health
curl http://localhost:8080/health
curl http://localhost:8080/api/todos

# Production
curl https://api.yourdomain.com/caddy-health
curl https://api.yourdomain.com/health
curl https://api.yourdomain.com/api/todos
```

### Test Load Balancing

```bash
# Send 30 requests and see distribution
for i in {1..30}; do
  curl -s http://localhost:8080/health | jq -r '.instance_id'
done | sort | uniq -c

# Expected output (roughly equal):
#   10 backend-1
#   10 backend-2
#   10 backend-3
```

## 🔄 Reload Configuration

Caddy can reload configuration without downtime:

```bash
# Reload configuration (development)
docker exec caddy-dev caddy reload --config /etc/caddy/Caddyfile

# Reload configuration (production)
docker exec caddy-prod caddy reload --config /etc/caddy/Caddyfile

# No connections are dropped during reload!
```

## 📝 Customization

### Change Domain (Production)

1. Open `Caddyfile.prod`
2. Replace `api.yourdomain.com` with your domain (appears 3 times)
3. Replace `your-email@example.com` with your email
4. Reload Caddy

### Add Rate Limiting

Caddy doesn't have built-in rate limiting in the free version. Options:

1. **Use backend rate limiting** (already implemented in Express)
2. **Install plugin**: `github.com/mholt/caddy-ratelimit`
3. **Use Caddy in front of Nginx** for rate limiting

### Add Caching

For advanced caching, install the cache-handler plugin:

```bash
# Build Caddy with cache plugin
FROM caddy:2.7-builder AS builder
RUN xcaddy build --with github.com/caddyserver/cache-handler

FROM caddy:2.7-alpine
COPY --from=builder /usr/bin/caddy /usr/bin/caddy
```

Then add to Caddyfile:

```caddyfile
handle /api/* {
    cache {
        ttl 5m
        match_path /api/*
        match_method GET
    }
    reverse_proxy ...
}
```

## 🆘 Troubleshooting

### Issue: "Port 80/443 already in use"

```bash
# Find what's using the port
sudo lsof -i :80
sudo lsof -i :443

# Stop the service or use different ports
```

### Issue: "SSL certificate not obtained"

```bash
# Check logs
docker logs caddy-prod | grep -i certificate

# Common causes:
# 1. DNS not pointing to server (check: dig api.yourdomain.com)
# 2. Firewall blocking port 80/443
# 3. Let's Encrypt rate limit (5 failures per hour)

# Force retry
docker exec caddy-prod caddy reload --config /etc/caddy/Caddyfile
```

### Issue: "Backend not responding"

```bash
# Check backend health
docker exec backend-1 wget -O- http://localhost:4001/health

# Check network connectivity
docker exec caddy-prod ping backend-1

# Check Caddy can reach backend
curl http://localhost:2019/config/apps/http/servers | jq '.srv0.routes[0].handle[0].upstreams'
```

### Issue: "WebSocket not connecting"

```bash
# Verify ip_hash is set for /socket.io/*
curl http://localhost:2019/config/ | jq '.apps.http.servers.srv0.routes[] | select(.match[0].path[0] == "/socket.io/*")'

# Check WebSocket upgrade headers
curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  http://localhost:8080/socket.io/
```

## 📚 Additional Resources

- [Caddy Documentation](https://caddyserver.com/docs/)
- [Caddyfile Syntax](https://caddyserver.com/docs/caddyfile)
- [Reverse Proxy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy)
- [Automatic HTTPS](https://caddyserver.com/docs/automatic-https)
- [Load Balancing](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy#load-balancing)

---

**Created**: November 13, 2025  
**Last Updated**: November 13, 2025  
**Version**: 1.0
