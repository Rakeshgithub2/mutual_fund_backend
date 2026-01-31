/**
 * Search & Pagination Integration Tests
 * Tests search, autocomplete, and pagination endpoints
 */

import request from 'supertest';
import app from '../src/app';
import { mongodb } from '../src/db/mongodb';

describe('Search & Pagination Integration Tests', () => {
  // Increase timeout for all tests in this suite
  jest.setTimeout(30000);

  beforeAll(async () => {
    await mongodb.connect();
  }, 30000);

  afterAll(async () => {
    await mongodb.disconnect();
  });

  describe('GET /api/funds/search', () => {
    it('should search funds by name', async () => {
      const response = await request(app)
        .get('/api/funds/search')
        .query({ q: 'axis' })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);

      if (response.body.data.length > 0) {
        const fund = response.body.data[0];
        expect(fund).toHaveProperty('fundId');
        expect(fund).toHaveProperty('name');
        expect(fund.name.toLowerCase()).toContain('axis');
      }
    });

    it('should return empty array for non-existent fund', async () => {
      const response = await request(app)
        .get('/api/funds/search')
        .query({ q: 'nonexistentfund12345' })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toEqual([]);
    });

    it('should handle special characters in search', async () => {
      const response = await request(app)
        .get('/api/funds/search')
        .query({ q: 'fund&special' })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });
  });

  describe('GET /api/suggest', () => {
    it('should provide autocomplete suggestions', async () => {
      const response = await request(app)
        .get('/api/suggest')
        .query({ q: 'hdfc' })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(Array.isArray(response.body.data)).toBe(true);

      if (response.body.data.length > 0) {
        const suggestion = response.body.data[0];
        expect(suggestion).toHaveProperty('name');
        expect(suggestion).toHaveProperty('fundId');
      }
    });

    it('should return suggestions quickly (performance test)', async () => {
      const startTime = Date.now();

      await request(app).get('/api/suggest').query({ q: 'icici' }).expect(200);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
    });
  });

  describe('GET /api/funds - Pagination', () => {
    it('should get first page of equity funds', async () => {
      const response = await request(app)
        .get('/api/funds')
        .query({
          category: 'equity',
          page: 1,
          limit: 100,
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeLessThanOrEqual(100);

      expect(response.body.pagination).toHaveProperty('page', 1);
      expect(response.body.pagination).toHaveProperty('limit', 100);
      expect(response.body.pagination).toHaveProperty('total');
    });

    it('should get second page of equity funds', async () => {
      const response = await request(app)
        .get('/api/funds')
        .query({
          category: 'equity',
          page: 2,
          limit: 100,
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.pagination).toHaveProperty('page', 2);
    });

    it('should get debt funds', async () => {
      const response = await request(app)
        .get('/api/funds')
        .query({
          category: 'debt',
          page: 1,
          limit: 100,
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data.length).toBeLessThanOrEqual(100);
    });

    it('should get commodity funds', async () => {
      const response = await request(app)
        .get('/api/funds')
        .query({
          category: 'commodity',
          page: 1,
          limit: 100,
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data.length).toBeLessThanOrEqual(100);
    });

    it('should respect custom limit', async () => {
      const response = await request(app)
        .get('/api/funds')
        .query({
          category: 'equity',
          page: 1,
          limit: 50,
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data.length).toBeLessThanOrEqual(50);
      expect(response.body.pagination).toHaveProperty('limit', 50);
    });

    it('should return all funds without category filter', async () => {
      const response = await request(app)
        .get('/api/funds')
        .query({
          page: 1,
          limit: 100,
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('GET /api/funds/:id - Fund Details', () => {
    let testFundId: string;

    beforeAll(async () => {
      // Get a fund ID to test with
      const response = await request(app)
        .get('/api/funds')
        .query({ page: 1, limit: 1 });

      if (response.body.data && response.body.data.length > 0) {
        testFundId = response.body.data[0].fundId;
      }
    }, 30000);

    it('should get fund details by ID', async () => {
      if (!testFundId) {
        console.log('Skipping - no test fund available');
        return;
      }

      const response = await request(app)
        .get(`/api/funds/${testFundId}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('fundId', testFundId);
      expect(response.body.data).toHaveProperty('name');
      expect(response.body.data).toHaveProperty('category');
    });

    it('should return 404 for non-existent fund ID', async () => {
      const response = await request(app)
        .get('/api/funds/nonexistent-fund-12345')
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('GET /api/funds/:fundId/manager - Fund Manager', () => {
    let testFundId: string;

    beforeAll(async () => {
      const response = await request(app)
        .get('/api/funds')
        .query({ page: 1, limit: 1 });

      if (response.body.data && response.body.data.length > 0) {
        testFundId = response.body.data[0].fundId;
      }
    }, 30000);

    it('should get fund manager details', async () => {
      if (!testFundId) {
        console.log('Skipping - no test fund available');
        return;
      }

      const response = await request(app)
        .get(`/api/funds/${testFundId}/manager`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      // Manager might not exist for all funds
      if (response.body.data) {
        expect(response.body.data).toHaveProperty('name');
      }
    });
  });
});
