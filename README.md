# Backend Development Guide

## 📁 Project Structure

```
backend/
├── src/
│   ├── index.ts              # Express app entry point
│   ├── worker.ts             # BullMQ worker process
│   ├── db/
│   │   ├── index.ts          # PostgreSQL connection pool
│   │   ├── init.sql          # Database schema
│   │   ├── migrate.ts        # Migration runner
│   │   └── seed.ts           # Seed data script
│   ├── routes/               # API route handlers
│   │   ├── auth.routes.ts
│   │   ├── user.routes.ts
│   │   ├── activity.routes.ts
│   │   ├── dashboard.routes.ts
│   │   ├── points.routes.ts
│   │   ├── partner.routes.ts
│   │   └── webhook.routes.ts
│   ├── middleware/           # Express middleware
│   │   ├── auth.ts           # JWT authentication
│   │   ├── errorHandler.ts
│   │   └── notFoundHandler.ts
│   └── utils/
│       └── logger.ts         # Winston logger
├── package.json
├── tsconfig.json
└── Dockerfile.dev
```

## 🚀 Getting Started

### Local Development (without Docker)

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Setup PostgreSQL**:
   ```bash
   # Make sure PostgreSQL is running
   createdb carbon_footprint
   ```

3. **Setup Redis**:
   ```bash
   # Make sure Redis is running
   redis-server
   ```

4. **Configure environment**:
   ```bash
   cp ../.env.example ../.env
   # Edit .env with your database credentials
   ```

5. **Run migrations**:
   ```bash
   npm run migrate
   ```

6. **Seed database** (optional):
   ```bash
   npm run seed
   ```

7. **Start development server**:
   ```bash
   npm run dev
   ```

8. **Start worker** (in separate terminal):
   ```bash
   npm run worker
   ```

The API will be available at http://localhost:3000

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run integration tests
npm run test:integration
```

## 📝 API Endpoints

### Authentication
- `GET /auth/google` - Initiate Google OAuth
- `GET /auth/google/callback` - OAuth callback
- `POST /auth/refresh` - Refresh access token
- `POST /auth/logout` - Logout

### User
- `GET /api/me` - Get current user profile
- `PATCH /api/me` - Update user profile

### Activities
- `POST /api/activities` - Create activity
- `GET /api/activities` - List activities
- `GET /api/activities/:id` - Get activity
- `DELETE /api/activities/:id` - Delete activity

### Dashboard
- `GET /api/dashboard/week/:week_start` - Weekly dashboard
- `GET /api/dashboard/month/:year/:month` - Monthly dashboard
- `GET /api/dashboard/leaderboard` - Leaderboard

### Points
- `GET /api/points` - Get points balance and ledger
- `POST /api/points/redeem` - Redeem points

### Partners (Admin)
- `POST /api/partners` - Create partner
- `GET /api/partners` - List partners
- `GET /api/partners/:id` - Get partner
- `PATCH /api/partners/:id` - Update partner

### Webhooks
- `POST /api/webhooks/partner-purchase` - Partner purchase webhook

## 🗄️ Database

### Running Migrations

```bash
npm run migrate
```

### Seeding Data

```bash
npm run seed
```

This will create:
- Emission factors for various activities
- A demo user account
- A demo partner with API credentials

### Direct Database Access

```bash
psql -d carbon_footprint
```

## 🔧 Development Tips

### Logging

The app uses Winston for structured logging:

```typescript
import { logger } from './utils/logger';

logger.info('User logged in', { userId: user.id });
logger.error('Database error', { error: err.message });
```

Logs are written to:
- Console (colorized)
- `logs/combined.log` (all logs)
- `logs/error.log` (errors only)

### Adding New Routes

1. Create route file in `src/routes/`
2. Import and register in `src/index.ts`
3. Add authentication middleware if needed

### Background Jobs

Add new job types in `src/worker.ts`:

```typescript
export const myQueue = new Queue('my-queue', { connection: redisConnection });

const myWorker = new Worker('my-queue', async (job) => {
  // Process job
}, { connection: redisConnection });
```

## 🔒 Security

- All routes except `/auth/*` and `/health` require JWT authentication
- Use the `authenticate` middleware for protected routes
- Webhooks use HMAC signature verification (not JWT)

## 📊 Monitoring

- Health check: `GET /health`
- Logs: Check `logs/` directory
- Queue monitoring: Use BullMQ Board (optional)

## 🐛 Troubleshooting

### Database connection errors
- Check PostgreSQL is running: `pg_isready`
- Verify DATABASE_URL in .env
- Check firewall/network settings

### Redis connection errors
- Check Redis is running: `redis-cli ping`
- Verify REDIS_URL in .env

### Port already in use
```bash
# Find process using port 3000
lsof -i :3000
# Kill it
kill -9 <PID>
```
