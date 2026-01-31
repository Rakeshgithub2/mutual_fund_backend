/**
 * Comparison Integration Tests
 * Tests compare and overlap endpoints
 */

import request from 'supertest';
import app from '../src/app';
import { mongodb } from '../src/db/mongodb';

describe('Comparison Integration Tests', () => {
  let testFundIds: string[] = [];

  beforeAll(async () => {
    await mongodb.connect();

    // Get some test fund IDs
    const response = await request(app)
      .get('/api/funds')
      .query({ page: 1, limit: 5 });

    if (response.body.data && response.body.data.length >= 2) {
      testFundIds = response.body.data
        .slice(0, 3)
        .map((fund: any) => fund.fundId);
    }
  });

  afterAll(async () => {
    await mongodb.disconnect();
  });

  describe('POST /api/comparison/compare', () => {
    it('should compare multiple funds', async () => {
      if (testFundIds.length < 2) {
        console.log('Skipping - not enough test funds available');
        return;
      }

      const response = await request(app)
        .post('/api/comparison/compare')
        .send({
          fundIds: [testFundIds[0], testFundIds[1]],
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data.funds)).toBe(true);
      expect(response.body.data.funds.length).toBe(2);

      // Check comparison metrics
      response.body.data.funds.forEach((fund: any) => {
        expect(fund).toHaveProperty('fundId');
        expect(fund).toHaveProperty('name');
        expect(fund).toHaveProperty('returns');
      });
    });

    it('should compare three funds', async () => {
      if (testFundIds.length < 3) {
        console.log('Skipping - not enough test funds available');
        return;
      }

      const response = await request(app)
        .post('/api/comparison/compare')
        .send({
          fundIds: testFundIds,
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data.funds.length).toBe(3);
    });

    it('should reject comparison with less than 2 funds', async () => {
      if (testFundIds.length < 1) {
        console.log('Skipping - no test funds available');
        return;
      }

      const response = await request(app)
        .post('/api/comparison/compare')
        .send({
          fundIds: [testFundIds[0]],
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should reject comparison without fundIds', async () => {
      const response = await request(app)
        .post('/api/comparison/compare')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should handle non-existent fund IDs gracefully', async () => {
      const response = await request(app)
        .post('/api/comparison/compare')
        .send({
          fundIds: ['nonexistent1', 'nonexistent2'],
        });

      // Should either return 404 or return empty comparison
      expect([200, 404]).toContain(response.status);
    });
  });

  describe('POST /api/comparison/overlap', () => {
    it('should calculate holdings overlap between funds', async () => {
      if (testFundIds.length < 2) {
        console.log('Skipping - not enough test funds available');
        return;
      }

      const response = await request(app)
        .post('/api/comparison/overlap')
        .send({
          fundIds: [testFundIds[0], testFundIds[1]],
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');

      // Check overlap structure
      expect(response.body.data).toHaveProperty('overlapPercentage');
      expect(typeof response.body.data.overlapPercentage).toBe('number');
    });

    it('should calculate overlap for three funds', async () => {
      if (testFundIds.length < 3) {
        console.log('Skipping - not enough test funds available');
        return;
      }

      const response = await request(app)
        .post('/api/comparison/overlap')
        .send({
          fundIds: testFundIds,
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('overlapPercentage');
    });

    it('should reject overlap calculation with less than 2 funds', async () => {
      if (testFundIds.length < 1) {
        console.log('Skipping - no test funds available');
        return;
      }

      const response = await request(app)
        .post('/api/comparison/overlap')
        .send({
          fundIds: [testFundIds[0]],
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should handle funds without holdings data', async () => {
      const response = await request(app)
        .post('/api/comparison/overlap')
        .send({
          fundIds: ['test-fund-1', 'test-fund-2'],
        });

      // Should handle gracefully with 0% overlap or 404
      expect([200, 404]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body.data.overlapPercentage).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Comparison Performance', () => {
    it('should compare funds quickly', async () => {
      if (testFundIds.length < 2) {
        console.log('Skipping - not enough test funds available');
        return;
      }

      const startTime = Date.now();

      await request(app)
        .post('/api/comparison/compare')
        .send({
          fundIds: [testFundIds[0], testFundIds[1]],
        });

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(responseTime).toBeLessThan(2000); // Should respond within 2 seconds
    });

    it('should calculate overlap quickly', async () => {
      if (testFundIds.length < 2) {
        console.log('Skipping - not enough test funds available');
        return;
      }

      const startTime = Date.now();

      await request(app)
        .post('/api/comparison/overlap')
        .send({
          fundIds: [testFundIds[0], testFundIds[1]],
        });

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(responseTime).toBeLessThan(2000); // Should respond within 2 seconds
    });
  });
});
