# Mutual Funds Backend API

A production-ready backend starter for a mutual fund platform built with Node.js, TypeScript, Express, and Prisma.

## Quick Start

```bash
# Install dependencies
npm install

# Setup environment variables
cp .env.example .env
# Edit .env with your database URL and JWT secrets

# Run database migrations
npm run db:migrate

# Generate Prisma client
npm run db:generate

# Start development server
npm run dev
```

## Tech Stack

- **Node.js** (LTS) + **TypeScript**
- **Express** - Web framework
- **Prisma ORM** - Database ORM with PostgreSQL
- **bcrypt** - Password hashing
- **jsonwebtoken** - JWT authentication
- **Zod** - Request validation
- **Jest** - Testing framework

## Project Structure

```
src/
├── controllers/     # Request handlers
├── services/        # Business logic
├── routes/          # API routes
├── db/              # Database connection
├── middlewares/     # Express middlewares
└── utils/           # Helper utilities
tests/               # Test files
prisma/              # Database schema and migrations
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Refresh access token

### Funds
- `GET /api/funds` - List funds with filtering and pagination
- `GET /api/funds/:id` - Get fund details with holdings and NAVs
- `GET /api/funds/:id/navs` - Get fund NAV history

### User Profile
- `GET /api/users/me` - Get user profile
- `PUT /api/users/me` - Update user profile

### Watchlist
- `POST /api/watchlist` - Add fund to watchlist
- `DELETE /api/watchlist/:id` - Remove from watchlist
- `GET /api/watchlist` - Get user watchlist

### Alerts
- `POST /api/alerts` - Create price alert
- `GET /api/alerts` - Get user alerts

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm test` - Run tests
- `npm run db:migrate` - Run database migrations
- `npm run db:generate` - Generate Prisma client

## Environment Variables

See `.env.example` for required environment variables.

## Docker

Build and run with Docker:

```bash
docker build -t mutual-funds-api .
docker run -p 3000:3000 mutual-funds-api
```
