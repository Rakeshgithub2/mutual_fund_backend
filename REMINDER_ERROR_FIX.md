# Backend Reminder Error Fix

## 🚨 Root Cause

The reminder scheduler is trying to use Mongoose `populate()` on User model, but User model doesn't exist as a Mongoose model (it's a MongoDB TypeScript model).

## ✅ Quick Fix: Disable Populate

Edit the file on EC2: `/home/ubuntu/mutual_fund_backend/src/jobs/reminder.job.js`

### Line 23-28 - Remove `.populate()` calls:

**BEFORE:**

```javascript
const reminders = await Reminder.find({
  status: 'PENDING',
  reminderDate: { $lte: now },
})
  .populate('userId', 'email firstName lastName name') // ❌ REMOVE THIS
  .populate('linkedGoal') // ❌ REMOVE THIS
  .lean();
```

**AFTER:**

```javascript
const reminders = await Reminder.find({
  status: 'PENDING',
  reminderDate: { $lte: now },
}).lean();
```

Then rebuild and restart:

```bash
npm run build
pm2 restart all
```

---

## ✅ Alternative Fix: Disable Reminder Scheduler (Fastest)

If reminders aren't critical right now, simply disable the scheduler:

```bash
# On EC2:
cd /home/ubuntu/mutual_fund_backend
nano src/app.js
```

Find line ~216-220 and comment out:

```javascript
// scheduleJob(
//   'reminders',
//   '*/5 * * * *',
//   () => reminderJob.execute()
// );
```

Then:

```bash
npm run build
pm2 restart all
```

---

## ✅ Proper Fix (Long-term)

Create a proper Mongoose User model or fetch user data separately without populate.

---

Choose Quick Fix or Alternative Fix depending on your needs!
