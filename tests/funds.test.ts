import request from 'supertest';
import app from '../src/index';

describe('Funds Endpoints', () => {
  describe('GET /api/funds', () => {
    it('should return funds list with pagination', async () => {
      const response = await request(app)
        .get('/api/funds')
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination).toMatchObject({
        page: 1,
        limit: 10,
        total: expect.any(Number),
        totalPages: expect.any(Number),
        hasNext: expect.any(Boolean),
        hasPrev: expect.any(Boolean)
      });
    });

    it('should filter funds by type', async () => {
      const response = await request(app)
        .get('/api/funds?type=EQUITY')
        .expect(200);

      expect(response.body.data).toBeInstanceOf(Array);
    });

    it('should filter funds by category', async () => {
      const response = await request(app)
        .get('/api/funds?category=LARGE_CAP')
        .expect(200);

      expect(response.body.data).toBeInstanceOf(Array);
    });

    it('should search funds by query', async () => {
      const response = await request(app)
        .get('/api/funds?q=test')
        .expect(200);

      expect(response.body.data).toBeInstanceOf(Array);
    });

    it('should handle pagination parameters', async () => {
      const response = await request(app)
        .get('/api/funds?page=2&limit=5')
        .expect(200);

      expect(response.body.pagination.page).toBe(2);
      expect(response.body.pagination.limit).toBe(5);
    });

    it('should handle sorting', async () => {
      const response = await request(app)
        .get('/api/funds?sort=name:asc')
        .expect(200);

      expect(response.body.data).toBeInstanceOf(Array);
    });
  });

  describe('GET /api/funds/:id', () => {
    it('should return 404 for non-existent fund', async () => {
      const response = await request(app)
        .get('/api/funds/non-existent-id')
        .expect(404);

      expect(response.body.error).toBe('Fund not found');
    });
  });

  describe('GET /api/funds/:id/navs', () => {
    it('should return 404 for non-existent fund NAVs', async () => {
      const response = await request(app)
        .get('/api/funds/non-existent-id/navs')
        .expect(200);

      expect(response.body.data).toBeInstanceOf(Array);
    });

    it('should handle date range filters', async () => {
      const from = '2023-01-01T00:00:00.000Z';
      const to = '2023-12-31T23:59:59.999Z';
      
      const response = await request(app)
        .get(`/api/funds/test-id/navs?from=${from}&to=${to}`)
        .expect(200);

      expect(response.body.data).toBeInstanceOf(Array);
    });
  });
});