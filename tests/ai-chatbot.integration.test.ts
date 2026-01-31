/**
 * AI Chatbot Integration Tests
 * Tests AI chat and fund analysis endpoints
 */

import request from 'supertest';
import app from '../src/app';
import { mongodb } from '../src/db/mongodb';

describe('AI Chatbot Integration Tests', () => {
  let testFundId: string;

  beforeAll(async () => {
    await mongodb.connect();

    // Get a test fund ID
    const response = await request(app)
      .get('/api/funds')
      .query({ page: 1, limit: 1 });

    if (response.body.data && response.body.data.length > 0) {
      testFundId = response.body.data[0].fundId;
    }
  });

  afterAll(async () => {
    await mongodb.disconnect();
  });

  describe('POST /api/ai/chat', () => {
    it('should respond to a basic mutual fund query', async () => {
      const response = await request(app)
        .post('/api/ai/chat')
        .send({
          query: 'What is the difference between equity and debt funds?',
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('response');
      expect(typeof response.body.data.response).toBe('string');
      expect(response.body.data.response.length).toBeGreaterThan(0);
    });

    it('should handle investment-related questions', async () => {
      const response = await request(app)
        .post('/api/ai/chat')
        .send({
          query: 'How do I choose the right mutual fund?',
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data.response.length).toBeGreaterThan(50);
    });

    it('should handle SIP-related queries', async () => {
      const response = await request(app)
        .post('/api/ai/chat')
        .send({
          query: 'What is SIP and how does it work?',
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('response');
    });

    it('should reject empty query', async () => {
      const response = await request(app)
        .post('/api/ai/chat')
        .send({
          query: '',
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should reject request without query', async () => {
      const response = await request(app)
        .post('/api/ai/chat')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should handle conversation context', async () => {
      const response = await request(app)
        .post('/api/ai/chat')
        .send({
          query: 'Tell me more about that',
          context: {
            conversationHistory: [
              {
                role: 'user',
                content: 'What are large cap funds?',
              },
              {
                role: 'assistant',
                content: 'Large cap funds invest in large companies...',
              },
            ],
          },
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('response');
    });

    it('should respond within reasonable time', async () => {
      const startTime = Date.now();

      await request(app)
        .post('/api/ai/chat')
        .send({
          query: 'What is NAV in mutual funds?',
        })
        .expect(200);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      // AI responses might take longer, but should be under 10 seconds
      expect(responseTime).toBeLessThan(10000);
    });
  });

  describe('GET /api/ai/suggestions', () => {
    it('should return suggested questions', async () => {
      const response = await request(app)
        .get('/api/ai/suggestions')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);

      // Check that suggestions are strings
      response.body.data.forEach((suggestion: any) => {
        expect(typeof suggestion).toBe('string');
        expect(suggestion.length).toBeGreaterThan(0);
      });
    });

    it('should return diverse suggestions', async () => {
      const response = await request(app)
        .get('/api/ai/suggestions')
        .expect(200);

      const suggestions = response.body.data;

      // Should have at least 5 different suggestions
      expect(suggestions.length).toBeGreaterThanOrEqual(5);

      // All suggestions should be unique
      const uniqueSuggestions = new Set(suggestions);
      expect(uniqueSuggestions.size).toBe(suggestions.length);
    });
  });

  describe('POST /api/ai/analyze-fund', () => {
    it('should analyze a specific fund', async () => {
      if (!testFundId) {
        console.log('Skipping - no test fund available');
        return;
      }

      const response = await request(app)
        .post('/api/ai/analyze-fund')
        .send({
          fundId: testFundId,
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('fundId', testFundId);
      expect(response.body.data).toHaveProperty('fundName');
      expect(response.body.data).toHaveProperty('analysis');
      expect(typeof response.body.data.analysis).toBe('string');
      expect(response.body.data.analysis.length).toBeGreaterThan(50);
    });

    it('should reject analysis without fundId', async () => {
      const response = await request(app)
        .post('/api/ai/analyze-fund')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should handle non-existent fund ID', async () => {
      const response = await request(app)
        .post('/api/ai/analyze-fund')
        .send({
          fundId: 'nonexistent-fund-12345',
        })
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should provide meaningful analysis', async () => {
      if (!testFundId) {
        console.log('Skipping - no test fund available');
        return;
      }

      const response = await request(app)
        .post('/api/ai/analyze-fund')
        .send({
          fundId: testFundId,
        })
        .expect(200);

      const analysis = response.body.data.analysis.toLowerCase();

      // Analysis should contain relevant financial terms
      const hasRelevantTerms =
        analysis.includes('fund') ||
        analysis.includes('return') ||
        analysis.includes('risk') ||
        analysis.includes('invest') ||
        analysis.includes('performance');

      expect(hasRelevantTerms).toBe(true);
    });
  });

  describe('AI Service Availability', () => {
    it('should handle missing AI API key gracefully', async () => {
      // This test checks if the system handles missing Gemini API key
      const response = await request(app).post('/api/ai/chat').send({
        query: 'Test query',
      });

      // Should either work (200) or return proper error (503)
      expect([200, 503]).toContain(response.status);

      if (response.status === 503) {
        expect(response.body).toHaveProperty('success', false);
        expect(response.body.message).toContain('not configured');
      }
    });
  });
});
