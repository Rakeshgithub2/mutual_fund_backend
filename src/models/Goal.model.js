/**
 * Goal Model
 * Stores user investment goals
 */

const mongoose = require('mongoose');

const goalSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    category: {
      type: String,
      enum: [
        'RETIREMENT',
        'EDUCATION',
        'HOME',
        'VEHICLE',
        'VACATION',
        'EMERGENCY_FUND',
        'WEALTH_CREATION',
        'OTHER',
      ],
      default: 'OTHER',
    },
    targetAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    currentAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    targetDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'ACHIEVED', 'PAUSED', 'CANCELLED'],
      default: 'ACTIVE',
    },
    linkedFunds: [
      {
        schemeCode: {
          type: String,
          required: true,
        },
        allocation: {
          type: Number,
          min: 0,
          max: 100,
          default: 0,
        },
      },
    ],
    monthlyContribution: {
      type: Number,
      min: 0,
      default: 0,
    },
    expectedReturnRate: {
      type: Number,
      min: 0,
      max: 100,
      default: 12,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
goalSchema.index({ status: 1 });
goalSchema.index({ targetDate: 1 });
goalSchema.index({ userId: 1, status: 1 });

// Virtual fields
goalSchema.virtual('progressPercentage').get(function () {
  if (this.targetAmount === 0) return 0;
  return Math.min((this.currentAmount / this.targetAmount) * 100, 100);
});

goalSchema.virtual('daysRemaining').get(function () {
  const now = new Date();
  const target = new Date(this.targetDate);
  const diff = target - now;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
});

goalSchema.virtual('monthsRemaining').get(function () {
  return Math.ceil(this.daysRemaining / 30);
});

// Ensure virtuals are included in JSON output
goalSchema.set('toJSON', { virtuals: true });
goalSchema.set('toObject', { virtuals: true });

// Static methods
goalSchema.statics.getUserGoals = function (userId, status = null) {
  const query = { userId };
  if (status) query.status = status;
  return this.find(query).sort({ createdAt: -1 });
};

goalSchema.statics.getActiveGoals = function (userId) {
  return this.getUserGoals(userId, 'ACTIVE');
};

goalSchema.statics.getAchievedGoals = function (userId) {
  return this.getUserGoals(userId, 'ACHIEVED');
};

goalSchema.statics.getUpcomingGoals = function (userId, days = 90) {
  const now = new Date();
  const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  return this.find({
    userId,
    status: 'ACTIVE',
    targetDate: {
      $gte: now,
      $lte: futureDate,
    },
  }).sort({ targetDate: 1 });
};

// Instance methods
goalSchema.methods.updateProgress = function (amount) {
  this.currentAmount = amount;
  if (this.currentAmount >= this.targetAmount && this.status === 'ACTIVE') {
    this.status = 'ACHIEVED';
  }
  return this.save();
};

goalSchema.methods.calculateRequiredMonthlyContribution = function () {
  if (this.daysRemaining <= 0) return 0;

  const remaining = this.targetAmount - this.currentAmount;
  if (remaining <= 0) return 0;

  const months = this.monthsRemaining;
  if (months <= 0) return remaining;

  // Simple calculation without considering returns
  return remaining / months;
};

const Goal = mongoose.model('Goal', goalSchema);

module.exports = Goal;
