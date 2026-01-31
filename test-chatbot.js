/**
 * Test Chatbot with Knowledge Base
 * Tests various scenarios including multi-question queries
 */

const axios = require('axios');

const API_URL = 'http://localhost:3002/api/ai/chat';

// Test cases
const testCases = [
  {
    name: 'Single question - What is SIP',
    message: 'What is SIP?',
  },
  {
    name: 'Single question - What is NAV',
    message: 'what is nav in mutual funds',
  },
  {
    name: 'Multiple questions in one query',
    message: 'What is SIP and what is NAV? Also explain CAGR.',
  },
  {
    name: 'Stock market question',
    message: 'What is PE ratio?',
  },
  {
    name: 'Debt funds question',
    message: 'What are gilt funds?',
  },
  {
    name: 'Commodity question',
    message: 'What is gold ETF?',
  },
  {
    name: 'Calculation question',
    message: 'How to calculate CAGR?',
  },
  {
    name: 'No match - random question',
    message: 'Tell me about cryptocurrency trading strategies',
  },
  {
    name: 'Multi-question with stock and MF',
    message: 'Explain IPO and also tell me about ELSS funds',
  },
];

async function testChatbot() {
  console.log('🧪 Testing Chatbot with Knowledge Base\n');
  console.log('='.repeat(80));

  for (const test of testCases) {
    console.log(`\n📝 Test: ${test.name}`);
    console.log(`❓ Query: "${test.message}"`);
    console.log('-'.repeat(80));

    try {
      const response = await axios.post(API_URL, {
        message: test.message,
      });

      if (response.data.success) {
        console.log(`✅ Success`);
        console.log(`📚 Source: ${response.data.source}`);

        if (response.data.matchedQuestion) {
          console.log(`🎯 Matched: "${response.data.matchedQuestion}"`);
          console.log(
            `📊 Confidence: ${(response.data.confidence * 100).toFixed(1)}%`
          );
        }

        if (response.data.matchedQuestions) {
          console.log(
            `🎯 Matched ${response.data.matchedQuestions.length} questions:`
          );
          response.data.matchedQuestions.forEach((mq) => {
            console.log(
              `   - ${mq.question} (score: ${(mq.score * 100).toFixed(1)}%)`
            );
          });
        }

        console.log(`\n💬 Response:`);
        console.log(
          response.data.reply.substring(0, 300) +
            (response.data.reply.length > 300 ? '...' : '')
        );
      } else {
        console.log(`❌ Failed: ${response.data.message}`);
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
      if (error.response) {
        console.log(`   Status: ${error.response.status}`);
        console.log(`   Data: ${JSON.stringify(error.response.data)}`);
      }
    }

    console.log('='.repeat(80));

    // Small delay between requests
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  console.log('\n✅ All tests completed!\n');
}

// Run tests
testChatbot().catch(console.error);
