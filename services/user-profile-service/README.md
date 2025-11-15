# User Profile Microservice

A dedicated microservice for managing user profiles, preferences, avatars, and profile analytics.

## Features

- ✅ **Profile Management** - Create, read, update, and delete user profiles
- ✅ **Avatar & Banner Upload** - Image upload with automatic resizing and optimization
- ✅ **User Preferences** - Theme, language, timezone, notifications, and more
- ✅ **Profile Analytics** - Track profile views and activity
- ✅ **Activity Logging** - Complete audit trail of profile changes
- ✅ **Redis Caching** - Fast profile retrieval with intelligent cache invalidation
- ✅ **Search** - Find profiles by display name or bio
- ✅ **Privacy Controls** - Public/private profiles with granular visibility settings

## Tech Stack

- **Runtime**: Node.js 20+ with TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL with Prisma ORM
- **Cache**: Redis
- **Image Processing**: Sharp
- **File Upload**: Multer
- **Authentication**: JWT (from auth-service)

## Database Schema

### UserProfile

- Basic profile info (name, bio, location, website, company, job title)
- Avatar and banner URLs
- Social links (Twitter, GitHub, LinkedIn)
- Privacy settings
- Analytics (views, last viewed)

### UserPreferences

- UI preferences (theme, language, timezone, date/time format)
- Notification preferences (email, push, desktop)
- Feature preferences (tutorials, animations, compact view)
- Privacy settings (analytics, marketing)

### ProfileActivity

- Activity log with type, description, metadata
- IP address and user agent tracking
- Timestamped audit trail

## API Endpoints

### Profile Management

```bash
POST   /profile                    # Create profile
GET    /profile/me                 # Get own profile
PUT    /profile                    # Update profile
DELETE /profile                    # Delete profile
GET    /profile/:userId            # Get user profile (public)
GET    /profile/search?q=term      # Search profiles
```

### Avatars & Banners

```bash
POST   /profile/avatar             # Upload avatar (256x256)
POST   /profile/banner             # Upload banner (1500x500)
```

### Preferences

```bash
GET    /profile/preferences        # Get preferences
PUT    /profile/preferences        # Update preferences
POST   /profile/preferences/reset  # Reset to defaults
```

### Activity

```bash
GET    /profile/activity           # Get activity log
```

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your configuration
```

### 3. Setup Database

```bash
# Generate Prisma Client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# (Optional) Open Prisma Studio
npm run prisma:studio
```

### 4. Start Service

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

## Environment Variables

| Variable            | Description                            | Default                  |
| ------------------- | -------------------------------------- | ------------------------ |
| `PORT`              | Service port                           | `4002`                   |
| `DATABASE_URL`      | PostgreSQL connection string           | Required                 |
| `REDIS_URL`         | Redis connection string                | `redis://localhost:6379` |
| `JWT_ACCESS_SECRET` | JWT signing secret (from auth-service) | Required                 |
| `UPLOAD_DIR`        | Upload directory                       | `./uploads`              |
| `MAX_FILE_SIZE`     | Max file size in bytes                 | `5242880` (5MB)          |
| `ENABLE_CACHE`      | Enable Redis caching                   | `true`                   |

## Docker Setup

```bash
# Build image
docker build -t user-profile-service .

# Run container
docker run -d \
  -p 4002:4002 \
  -e DATABASE_URL="postgresql://..." \
  -e REDIS_URL="redis://..." \
  --name user-profile-service \
  user-profile-service
```

## Integration with Auth Service

This service validates JWT tokens issued by the auth-service. Ensure both services share the same `JWT_ACCESS_SECRET`.

```typescript
// Example request with authentication
fetch('http://localhost:4002/profile/me', {
  headers: {
    Authorization: `Bearer ${accessToken}`,
  },
});
```

## Example Usage

### Create Profile

```bash
curl -X POST http://localhost:4002/profile \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "displayName": "John Doe",
    "bio": "Software engineer and open source enthusiast",
    "location": "San Francisco, CA",
    "website": "https://johndoe.com"
  }'
```

### Upload Avatar

```bash
curl -X POST http://localhost:4002/profile/avatar \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "avatar=@/path/to/image.jpg"
```

### Update Preferences

```bash
curl -X PUT http://localhost:4002/profile/preferences \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "theme": "DARK",
    "language": "en",
    "emailNotifications": true,
    "pushNotifications": false
  }'
```

## Testing

```bash
# Run tests
npm test

# Watch mode
npm run test:watch
```

## Health Check

```bash
curl http://localhost:4002/health
```

Response:

```json
{
  "status": "ok",
  "service": "user-profile-service",
  "timestamp": "2025-11-15T04:00:00.000Z",
  "uptime": 123.456
}
```

## Architecture

```
┌─────────────────┐
│  Client/Shell   │
└────────┬────────┘
         │
         │ JWT Token
         ▼
┌─────────────────┐      ┌──────────────┐
│ Profile Service │─────▶│  PostgreSQL  │
│   Port 4002     │      │  profile_db  │
└────────┬────────┘      └──────────────┘
         │
         │ Cache
         ▼
    ┌────────┐
    │ Redis  │
    └────────┘
```

## Development

- **Hot Reload**: Uses `tsx watch` for instant restarts
- **Type Safety**: Full TypeScript coverage
- **Code Quality**: ESLint and Prettier configured
- **Database**: Prisma for type-safe database access
- **Caching**: Redis for performance optimization

## Production Checklist

- [ ] Set strong `JWT_ACCESS_SECRET` (32+ characters)
- [ ] Configure production `DATABASE_URL`
- [ ] Set up S3 or object storage for uploads (optional)
- [ ] Enable HTTPS/TLS
- [ ] Configure rate limiting appropriately
- [ ] Set up monitoring and alerts
- [ ] Configure log aggregation
- [ ] Enable database backups
- [ ] Review and adjust `MAX_FILE_SIZE`
- [ ] Set `NODE_ENV=production`

## License

MIT
