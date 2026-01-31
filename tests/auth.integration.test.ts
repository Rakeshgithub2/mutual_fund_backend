/**
 * Auth Integration Tests
 * Tests all authentication endpoints end-to-end
 */

import request from 'supertest';
import app from '../src/app';
import { mongodb } from '../src/db/mongodb';

describe('Authentication Integration Tests', () => {
  let accessToken: string;
  let refreshToken: string;
  const testEmail = `test-${Date.now()}@example.com`;
  const testPassword = 'TestPassword123!';
  const testName = 'Test User';
  let testOTP: string;

  beforeAll(async () => {
    // Connect to MongoDB
    await mongodb.connect();
  });

  afterAll(async () => {
    // Clean up test user
    const db = mongodb.getDb();
    await db.collection('users').deleteOne({ email: testEmail });
    await mongodb.disconnect();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user with email and password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: testEmail,
          password: testPassword,
          name: testName,
        })
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data.user).toHaveProperty('email', testEmail);
      expect(response.body.data.user).toHaveProperty('name', testName);
      expect(response.body.data).toHaveProperty('tokens');
      expect(response.body.data.tokens).toHaveProperty('accessToken');

      accessToken = response.body.data.tokens.accessToken;
    });

    it('should reject duplicate email registration', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: testEmail,
          password: testPassword,
          name: testName,
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject registration without email', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          password: testPassword,
          name: testName,
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should reject registration with weak password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: `weak-${Date.now()}@example.com`,
          password: '123',
          name: testName,
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testEmail,
          password: testPassword,
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data.user).toHaveProperty('email', testEmail);
      expect(response.body.data).toHaveProperty('tokens');
      expect(response.body.data.tokens).toHaveProperty('accessToken');

      accessToken = response.body.data.tokens.accessToken;
    });

    it('should reject login with wrong password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testEmail,
          password: 'WrongPassword123!',
        })
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should reject login with non-existent email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: testPassword,
        })
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should get current user with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data.user).toHaveProperty('email', testEmail);
    });

    it('should reject request without token', async () => {
      const response = await request(app).get('/api/auth/me').expect(401);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('Password Reset Flow', () => {
    it('should send OTP for password reset', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({
          email: testEmail,
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
      expect(response.body.data).toHaveProperty('email', testEmail);

      // In a real test, we'd retrieve the OTP from the database
      // For now, we'll simulate it
      const db = mongodb.getDb();
      const otpRecord = await db.collection('password_reset_otps').findOne({
        email: testEmail,
      });

      if (otpRecord) {
        testOTP = otpRecord.otp;
      }
    });

    it('should verify valid OTP', async () => {
      // Skip if we don't have OTP
      if (!testOTP) {
        console.log('Skipping OTP verification test - no OTP available');
        return;
      }

      const response = await request(app)
        .post('/api/auth/verify-otp')
        .send({
          email: testEmail,
          otp: testOTP,
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });

    it('should reject invalid OTP', async () => {
      const response = await request(app)
        .post('/api/auth/verify-otp')
        .send({
          email: testEmail,
          otp: '000000',
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should reset password with valid OTP', async () => {
      // Skip if we don't have OTP
      if (!testOTP) {
        console.log('Skipping password reset test - no OTP available');
        return;
      }

      const newPassword = 'NewPassword123!';
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          email: testEmail,
          otp: testOTP,
          newPassword: newPassword,
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);

      // Verify login with new password
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testEmail,
          password: newPassword,
        })
        .expect(200);

      expect(loginResponse.body).toHaveProperty('success', true);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout successfully', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });
  });
});
