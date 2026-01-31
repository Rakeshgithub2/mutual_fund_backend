/**
 * Reminder Model
 * User reminders for SIP, goals, and other activities
 */

const mongoose = require('mongoose');

const reminderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // Reminder details
    type: {
      type: String,
      enum: ['SIP', 'GOAL_REVIEW', 'REBALANCE', 'DOCUMENT', 'CUSTOM'],
      required: true,
      index: true,
    },

    title: {
      type: String,
      required: true,
    },
    description: String,

    // Scheduling
    reminderDate: {
      type: Date,
      required: true,
      index: true,
    },
    frequency: {
      type: String,
      enum: ['ONCE', 'DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY'],
      default: 'ONCE',
    },

    // Status
    status: {
      type: String,
      enum: ['PENDING', 'SENT', 'COMPLETED', 'CANCELLED'],
      default: 'PENDING',
      index: true,
    },

    // Linked entities
    linkedGoal: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Goal',
    },
    linkedFunds: [
      {
        type: String, // schemeCode
      },
    ],

    // Notification preferences
    notifyVia: {
      email: {
        type: Boolean,
        default: true,
      },
      push: {
        type: Boolean,
        default: false,
      },
    },

    // SIP specific fields
    sipDetails: {
      amount: Number,
      date: Number, // Day of month (1-31)
      fundSchemeCode: String,
    },

    // Execution tracking
    lastSentAt: Date,
    nextScheduledAt: Date,
    sentCount: {
      type: Number,
      default: 0,
    },

    // User actions
    dismissedAt: Date,
    completedAt: Date,
  },
  {
    timestamps: true,
    collection: 'reminders',
  }
);

// Indexes
reminderSchema.index({ userId: 1, status: 1 });
reminderSchema.index({ reminderDate: 1, status: 1 });
reminderSchema.index({ nextScheduledAt: 1, status: 1 });
reminderSchema.index({ type: 1, userId: 1 });

// Static methods
reminderSchema.statics.getPendingReminders = function () {
  return this.find({
    status: 'PENDING',
    reminderDate: { $lte: new Date() },
  })
    .populate('userId', 'email firstName lastName')
    .lean();
};

reminderSchema.statics.getUserReminders = function (userId, status = null) {
  const query = { userId };
  if (status) query.status = status;

  return this.find(query)
    .sort({ reminderDate: 1 })
    .populate('linkedGoal')
    .lean();
};

reminderSchema.statics.getUpcomingReminders = function (userId, days = 7) {
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + days);

  return this.find({
    userId,
    status: 'PENDING',
    reminderDate: {
      $gte: new Date(),
      $lte: endDate,
    },
  })
    .sort({ reminderDate: 1 })
    .lean();
};

// Methods
reminderSchema.methods.markAsSent = function () {
  this.status = 'SENT';
  this.lastSentAt = new Date();
  this.sentCount += 1;

  // Calculate next scheduled date if recurring
  if (this.frequency !== 'ONCE') {
    this.nextScheduledAt = this.calculateNextSchedule();
    this.status = 'PENDING'; // Reset to pending for next occurrence
  }

  return this.save();
};

reminderSchema.methods.markAsCompleted = function () {
  this.status = 'COMPLETED';
  this.completedAt = new Date();
  return this.save();
};

reminderSchema.methods.calculateNextSchedule = function () {
  const current = this.reminderDate || new Date();
  const next = new Date(current);

  switch (this.frequency) {
    case 'DAILY':
      next.setDate(next.getDate() + 1);
      break;
    case 'WEEKLY':
      next.setDate(next.getDate() + 7);
      break;
    case 'MONTHLY':
      next.setMonth(next.getMonth() + 1);
      break;
    case 'QUARTERLY':
      next.setMonth(next.getMonth() + 3);
      break;
    case 'YEARLY':
      next.setFullYear(next.getFullYear() + 1);
      break;
  }

  return next;
};

const Reminder = mongoose.model('Reminder', reminderSchema);

module.exports = Reminder;
