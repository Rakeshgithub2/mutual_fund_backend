import { ObjectId } from 'mongodb';

export interface User {
  _id?: ObjectId;
  email: string;
  password: string;
  name: string; // Full name (for backward compatibility)
  firstName?: string; // First name (new)
  lastName?: string; // Last name (new)
  profilePicture?: string; // Google profile picture URL
  age?: number;
  riskLevel?: string; // LOW, MEDIUM, HIGH
  role: string; // USER, ADMIN
  isVerified: boolean;
  kycStatus: string; // PENDING, SUBMITTED, APPROVED, REJECTED

  // OAuth fields
  googleId?: string;
  provider?: string; // 'local' | 'google'

  createdAt: Date;
  updatedAt: Date;
}

export interface RefreshToken {
  _id?: ObjectId;
  token: string;
  userId: ObjectId;
  expiresAt: Date;
  createdAt: Date;
}

// Password reset OTP
export interface PasswordResetOTP {
  _id?: ObjectId;
  email: string;
  otp: string; // 6-digit OTP code
  expiresAt: Date;
  verified: boolean;
  attempts: number; // Track failed attempts
  createdAt: Date;
}
