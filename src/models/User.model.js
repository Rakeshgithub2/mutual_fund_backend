/**
 * User Model
 * Stores user authentication and profile data
 */

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: {
      type: String,
      required: false, // Not required for Google OAuth users
    },
    firstName: {
      type: String,
      trim: true,
    },
    lastName: {
      type: String,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    profilePicture: {
      type: String,
      trim: true,
    },
    authProvider: {
      type: String,
      enum: ['local', 'google'],
      default: 'local',
    },
    googleId: {
      type: String,
      sparse: true,
      unique: true,
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    role: {
      type: String,
      enum: ['user', 'premium', 'admin'],
      default: 'user',
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    lastLogin: {
      type: Date,
    },
    resetPasswordOTP: {
      type: String,
      select: false, // Don't include in queries by default
    },
    resetPasswordOTPExpiry: {
      type: Date,
      select: false,
    },
    resetPasswordToken: {
      type: String,
      select: false,
    },
    resetPasswordTokenExpiry: {
      type: Date,
      select: false,
    },
    refreshTokens: {
      type: [String],
      default: [],
      select: false, // Don't include in queries by default
    },
    preferences: {
      currency: {
        type: String,
        default: 'INR',
      },
      notifications: {
        email: {
          type: Boolean,
          default: true,
        },
        push: {
          type: Boolean,
          default: false,
        },
      },
      theme: {
        type: String,
        enum: ['light', 'dark', 'auto'],
        default: 'auto',
      },
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
userSchema.index({ role: 1 });
userSchema.index({ createdAt: -1 });

// Instance methods
userSchema.methods.toPublicJSON = function () {
  const user = this.toObject();
  delete user.password;
  delete user.__v;
  return user;
};

// Static methods
userSchema.statics.findByEmail = function (email) {
  return this.findOne({ email: email.toLowerCase() });
};

const User = mongoose.model('User', userSchema);

module.exports = User;
