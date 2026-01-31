# 🚀 Automated Financial Data Pipeline - Production System

## Overview

This is a **fully automated, production-grade financial data update system** that keeps your mutual funds platform always fresh with real-time market data, daily NAV updates, and optimized graph data.

### ✨ Key Features

- **Real-time Market Indices**: Updates every 5 minutes during market hours
- **Daily NAV Updates**: Automatic NAV fetching at 10:30 PM IST
- **Weekly Graph Aggregation**: Optimized chart data for 1Y/3Y/5Y returns
- **WebSocket Live Updates**: Real-time push to frontend without refresh
- **Smart Market Calendar**: Auto-handles weekends, holidays, trading halts
- **Storage Optimization**: Keeps only 5 years of NAV history with auto-cleanup
- **Automated Job Scheduler**: BullMQ-based with retry logic and error alerts
- **Production Ready**: Zero manual intervention after deployment

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     AUTOMATED JOBS                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  📈 Market Indices Job (Every 5 min when market open)      │
│     ├─ Check market calendar                               │
│     ├─ Fetch from NSE/BSE API                              │
│     ├─ Update MongoDB (overwrite old)                      │
│     └─ Push to WebSocket clients                           │
│                                                             │
│  💰 Daily NAV Job (10:30 PM IST daily)                     │
│     ├─ Fetch from AMFI                                     │
│     ├─ Match with fund IDs                                 │
│     ├─ Store last 5 years (auto-cleanup)                   │
│     └─ Trigger returns calculation                         │
│                                                             │
│  📊 Weekly Graph Job (Sunday 2:00 AM)                      │
│     ├─ Aggregate NAV by week                               │
│     ├─ Generate 1Y/3Y/5Y points                            │
│     └─ Store optimized graph data                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    MONGODB COLLECTIONS                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  market_calendar          → Holidays & trading days         │
│  market_indices_latest    → Latest index values only        │
│  mf_nav_history           → Daily NAV (5-year retention)    │
│  mf_returns_latest        → Calculated 1Y/3Y/5Y returns     │
│  mf_nav_graph             → Weekly aggregated graph points  │
│                                                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                      LIVE UPDATES                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  WebSocket (Socket.IO)                                      │
│     ├─ market:status    → Open/Closed                      │
│     ├─ market:indices   → Latest indices                   │
│     └─ market:update    → Real-time push                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚦 Getting Started

### Prerequisites

```bash
✅ Node.js >= 18.0.0
✅ MongoDB (with replica set for TTL)
✅ Redis (for BullMQ job queue)
✅ Environment variables configured
```

### Installation

```bash
# Install dependencies
cd mutual-funds-backend
pnpm install

# Initialize system (holidays, indices)
pnpm run init:system

# Start automated server
pnpm run dev:automated
```

### Environment Variables

```env
# MongoDB
DATABASE_URL=mongodb://localhost:27017/mutual-funds

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Server
PORT=3002
NODE_ENV=production
FRONTEND_URL=http://localhost:5001

# Optional: Alerts
SLACK_WEBHOOK_URL=https://hooks.slack.com/...
ADMIN_EMAIL=admin@example.com
```

---

## 📋 Available Commands

### Server Commands

```bash
# Start automated server (production mode)
pnpm run start:automated

# Development mode with auto-reload
pnpm run dev:automated
```

### Initialization & Setup

```bash
# Initialize system (run once)
pnpm run init:system
# Sets up market calendar, holidays, default indices

# Reset and reinitialize (if needed)
pnpm run init:system
```

### Manual Job Triggers

```bash
# Trigger market indices update (manual)
pnpm run job:market

# Trigger daily NAV update (manual)
pnpm run job:nav

# Trigger graph aggregation (manual)
pnpm run job:graph
```

---

## 🔌 API Endpoints

### Market Status

```http
GET /api/market-data/status
```

Response:

```json
{
  "success": true,
  "data": {
    "isOpen": true,
    "reason": null,
    "currentTime": "31 Jan 2026, 10:45 AM",
    "timestamp": "2026-01-31T05:15:00.000Z"
  }
}
```

### Market Indices

```http
GET /api/market-data/indices
GET /api/market-data/indices/major
GET /api/market-data/indices/:symbol
```

### Fund Data

```http
GET /api/market-data/funds/:fundId/returns
GET /api/market-data/funds/:fundId/nav/latest
GET /api/market-data/funds/:fundId/nav/history?days=365
GET /api/market-data/funds/:fundId/graph/:period  (1Y, 3Y, 5Y)
GET /api/market-data/funds/:fundId/graph/all
```

### Admin Endpoints

```http
POST /api/market-data/admin/jobs/trigger/:jobName
GET  /api/market-data/admin/jobs/stats
```

Job names: `market-indices`, `daily-nav`, `weekly-graph`

---

## 🔌 WebSocket Events

### Client → Server

```javascript
// Subscribe to market updates
socket.emit('market:subscribe', ['NIFTY50', 'SENSEX']);

// Request manual refresh
socket.emit('market:refresh');
```

### Server → Client

```javascript
// Market status
socket.on('market:status', (data) => {
  // { isOpen, reason, currentTime, timestamp }
});

// Initial indices data
socket.on('market:indices', (data) => {
  // Array of all indices
});

// Real-time updates (every 5 min)
socket.on('market:update', (data) => {
  // { indices, timestamp }
});

// Errors
socket.on('market:error', (error) => {
  // { message }
});
```

---

## 📊 Data Retention Policy

| Data Type          | Retention       | Cleanup Method |
| ------------------ | --------------- | -------------- |
| Market Indices     | Latest only     | Overwrite      |
| NAV History        | 5 years         | TTL + Manual   |
| Returns (1Y/3Y/5Y) | Latest only     | Overwrite      |
| Graph Data         | Latest + Weekly | Stale cleanup  |
| Market Calendar    | Permanent       | None           |

---

## ⏰ Job Schedule

| Job               | Frequency             | Description                   |
| ----------------- | --------------------- | ----------------------------- |
| Market Indices    | Every 5 minutes       | Only when market is open      |
| Daily NAV         | 10:30 PM IST daily    | Fetch and store NAV from AMFI |
| Returns Calc      | After NAV update      | Calculate 1Y/3Y/5Y returns    |
| Graph Aggregation | Sunday 2:00 AM weekly | Generate optimized chart data |

---

## 🛡️ Error Handling & Monitoring

### Retry Logic

All jobs automatically retry on failure:

- Market Indices: 3 retries with 1-minute delay
- Daily NAV: 5 retries with 5-minute delay
- Graph Aggregation: 3 retries with 10-minute delay

### Alerts (TODO)

Configure alerts in [`job-scheduler.ts`](src/schedulers/job-scheduler.ts):

```typescript
// On job failure
if (failureCount > 3) {
  sendSlackAlert(`Job ${jobName} failed ${failureCount} times`);
  sendEmailAlert(adminEmail, jobFailureDetails);
}
```

### Health Check

```http
GET /api/market-data/health
```

Response includes:

- Server status
- Market open/closed
- Data freshness (stale warning)
- Last update timestamps

---

## 🧪 Testing

### Test Individual Jobs

```bash
# Test market indices fetch
curl http://localhost:3002/api/market-data/admin/jobs/trigger/market-indices

# Test NAV update
curl -X POST http://localhost:3002/api/market-data/admin/jobs/trigger/daily-nav

# Test graph aggregation
curl -X POST http://localhost:3002/api/market-data/admin/jobs/trigger/weekly-graph
```

### Check Job Stats

```bash
curl http://localhost:3002/api/market-data/admin/jobs/stats
```

---

## 📁 Project Structure

```
mutual-funds-backend/
├── src/
│   ├── services/
│   │   ├── market-calendar.service.ts    # Market hours & holidays
│   │   ├── market-indices.service.ts     # Latest indices data
│   │   ├── nav.service.ts                # NAV history & returns
│   │   └── graph-data.service.ts         # Aggregated chart data
│   │
│   ├── jobs/
│   │   ├── market-indices.job.ts         # 5-min market update
│   │   ├── daily-nav.job.ts              # Daily NAV fetch
│   │   └── weekly-graph.job.ts           # Weekly aggregation
│   │
│   ├── schedulers/
│   │   └── job-scheduler.ts              # BullMQ scheduler
│   │
│   ├── websocket/
│   │   └── market-websocket.ts           # Socket.IO live updates
│   │
│   ├── routes/
│   │   └── market-data.routes.ts         # API endpoints
│   │
│   ├── scripts/
│   │   └── initialize-system.ts          # One-time setup
│   │
│   └── server-automated.ts               # Main server entry
```

---

## 🎯 Production Deployment

### Vercel Deployment

Add to `vercel.json`:

```json
{
  "builds": [
    {
      "src": "src/server-automated.ts",
      "use": "@vercel/node"
    }
  ],
  "routes": [{ "src": "/(.*)", "dest": "src/server-automated.ts" }]
}
```

### Environment Variables (Vercel)

Add in Vercel Dashboard → Settings → Environment Variables:

- `DATABASE_URL`
- `REDIS_HOST`
- `REDIS_PORT`
- `FRONTEND_URL`

### Note on Cron Jobs

⚠️ **Vercel Limitation**: Serverless functions have max 10-second execution time.

**Solution**: Use external cron service:

- **Vercel Cron** (Beta): For scheduled functions
- **EasyCron**: HTTP-based triggers
- **AWS EventBridge**: Cloud-native scheduler
- **Google Cloud Scheduler**: Managed cron

Example (EasyCron):

```
# Every 5 minutes
https://your-backend.vercel.app/api/market-data/admin/jobs/trigger/market-indices

# Daily 10:30 PM IST
30 22 * * * https://your-backend.vercel.app/api/market-data/admin/jobs/trigger/daily-nav
```

---

## 🔥 Performance Optimizations

### Database Indexes

Automatically created on first run:

```javascript
// market_indices_latest
{ symbol: 1 }
{ lastUpdated: -1 }

// mf_nav_history
{ fundId: 1, date: -1 }
{ amfiCode: 1, date: -1 }
{ date: 1 } // TTL index

// mf_returns_latest
{ fundId: 1 }

// mf_nav_graph
{ fundId: 1, period: 1 } // unique
```

### Caching Strategy

- Market Indices: Fresh every 5 min
- Returns: Cached until next NAV update
- Graph Data: Cached for 7 days

---

## 🐛 Troubleshooting

### Market Indices Not Updating

1. Check market status: `GET /api/market-data/status`
2. Verify BullMQ worker is running
3. Check Redis connection
4. View logs: Worker should log "Market is OPEN" or "Market is closed"

### NAV Not Updating

1. Check AMFI API: `https://www.amfiindia.com/spages/NAVAll.txt`
2. Verify fund AMFI codes in database
3. Check MongoDB connection
4. Manual trigger: `POST /api/admin/jobs/trigger/daily-nav`

### WebSocket Not Connecting

1. Verify Socket.IO client version matches server
2. Check CORS settings
3. Ensure port 3002 is accessible
4. Check browser console for errors

---

## 📝 License

MIT

---

## 🤝 Contributing

PRs welcome! Please read CONTRIBUTING.md first.

---

## 📞 Support

For issues, please open a GitHub issue with:

- Environment (local/staging/production)
- Logs from failing job
- Steps to reproduce

---

**Built with ❤️ for production-grade financial platforms**
