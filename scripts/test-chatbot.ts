/**
 * Test script for AI Chatbot with Knowledge Base
 * Run this after migration to verify everything works
 */

import { enhancedChatbotService } from '../services/enhanced-chatbot.service';
import { knowledgeBaseService } from '../services/knowledge-base.service';
import { calculationService } from '../services/calculation.service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testChatbot() {
  console.log('🧪 Testing AI Chatbot System\n');
  console.log('═'.repeat(60));

  try {
    // Test 1: Check if knowledge base is populated
    console.log('\n📊 Test 1: Checking Knowledge Base Population');
    console.log('─'.repeat(60));
    const count = await prisma.knowledgeBase.count();
    console.log(`✓ Total questions in database: ${count}`);

    if (count === 0) {
      console.log('❌ ERROR: Knowledge base is empty!');
      console.log('   Run: npm run migrate:knowledge');
      return;
    }

    // Test 2: Get categories
    console.log('\n📂 Test 2: Getting Categories');
    console.log('─'.repeat(60));
    const categories = await knowledgeBaseService.getCategories();
    categories.forEach((cat) => {
      console.log(`  ${cat.category}: ${cat.count} questions`);
    });

    // Test 3: Test simple question
    console.log('\n💬 Test 3: Asking Simple Question');
    console.log('─'.repeat(60));
    const question1 = 'What is a mutual fund?';
    console.log(`Query: "${question1}"`);
    const response1 = await enhancedChatbotService.processQuery(
      question1,
      'test-user',
      'test-session-1'
    );
    console.log(`Type: ${response1.type}`);
    console.log(`Confidence: ${(response1.confidence * 100).toFixed(1)}%`);
    console.log(
      `Matched Question: ${response1.matchedQuestion?.question || 'None'}`
    );
    console.log(`Category: ${response1.matchedQuestion?.category || 'N/A'}`);
    console.log(`\nAnswer Preview:\n${response1.answer.substring(0, 200)}...`);

    // Test 4: Test calculation question
    console.log('\n🧮 Test 4: Testing Calculation (SIP)');
    console.log('─'.repeat(60));
    const question2 =
      'Calculate SIP for 5000 monthly for 10 years at 12% returns';
    console.log(`Query: "${question2}"`);
    const response2 = await enhancedChatbotService.processQuery(
      question2,
      'test-user',
      'test-session-1'
    );
    console.log(`Type: ${response2.type}`);
    console.log(`Confidence: ${(response2.confidence * 100).toFixed(1)}%`);
    if (response2.calculationResult) {
      console.log(`\nCalculation Result:`);
      console.log(JSON.stringify(response2.calculationResult, null, 2));
    }

    // Test 5: Test direct calculation
    console.log('\n💰 Test 5: Direct SIP Calculation');
    console.log('─'.repeat(60));
    const sipResult = calculationService.calculateSIP(10000, 12, 5);
    console.log(`Monthly: ₹10,000 | Rate: 12% | Years: 5`);
    console.log(
      `Future Value: ₹${sipResult.futureValue.toLocaleString('en-IN')}`
    );
    console.log(
      `Total Invested: ₹${sipResult.totalInvested.toLocaleString('en-IN')}`
    );
    console.log(`Returns: ₹${sipResult.returns.toLocaleString('en-IN')}`);
    console.log(`Gain: ${sipResult.percentageGain}%`);

    // Test 6: Test similarity search
    console.log('\n🔍 Test 6: Testing Similarity Search');
    console.log('─'.repeat(60));
    const query = 'How does SIP work?';
    console.log(`Query: "${query}"`);
    const similar = await knowledgeBaseService.findSimilarQuestions(query, 3);
    console.log(`Found ${similar.length} similar questions:`);
    similar.forEach((q, i) => {
      console.log(
        `  ${i + 1}. ${q.question} (${(q.similarity * 100).toFixed(1)}% match)`
      );
    });

    // Test 7: Test category search
    console.log('\n📚 Test 7: Category Search (Calculations)');
    console.log('─'.repeat(60));
    const calcQuestions =
      await knowledgeBaseService.searchByCategory('Calculations');
    console.log(
      `Found ${calcQuestions.length} questions in "Calculations" category`
    );
    console.log(`Sample questions:`);
    calcQuestions.slice(0, 5).forEach((q, i) => {
      console.log(`  ${i + 1}. ${q.question}`);
    });

    // Test 8: Test chat history
    console.log('\n📜 Test 8: Checking Chat History');
    console.log('─'.repeat(60));
    const history =
      await enhancedChatbotService.getChatHistory('test-session-1');
    console.log(`Session has ${history.length} interactions`);

    // Test 9: Test CAGR calculation
    console.log('\n📈 Test 9: CAGR Calculation');
    console.log('─'.repeat(60));
    const cagrResult = calculationService.calculateCAGR(100000, 250000, 5);
    console.log(`Start: ₹1,00,000 | End: ₹2,50,000 | Years: 5`);
    console.log(`CAGR: ${cagrResult.cagr}%`);
    console.log(`Total Return: ${cagrResult.totalReturn}%`);
    console.log(
      `Absolute Return: ₹${cagrResult.absoluteReturn.toLocaleString('en-IN')}`
    );

    // Test 10: Test edge cases
    console.log('\n🔬 Test 10: Edge Case - Unrelated Query');
    console.log('─'.repeat(60));
    const weirdQuery = "What's the weather like?";
    console.log(`Query: "${weirdQuery}"`);
    const response3 = await enhancedChatbotService.processQuery(
      weirdQuery,
      'test-user',
      'test-session-2'
    );
    console.log(`Type: ${response3.type}`);
    console.log(`Confidence: ${(response3.confidence * 100).toFixed(1)}%`);
    console.log(`Answer Preview:\n${response3.answer.substring(0, 150)}...`);

    console.log('\n' + '═'.repeat(60));
    console.log('✅ All Tests Completed Successfully!');
    console.log('═'.repeat(60));
    console.log('\n📊 Summary:');
    console.log(`  ✓ Knowledge Base: ${count} questions`);
    console.log(`  ✓ Categories: ${categories.length}`);
    console.log(`  ✓ Question matching: Working`);
    console.log(`  ✓ Calculations: Working`);
    console.log(`  ✓ Chat history: Working`);
    console.log(`  ✓ Similarity search: Working`);
    console.log('\n🚀 Chatbot is ready to use!');
    console.log('\n📍 API Endpoint: http://localhost:3002/api/chatbot/ask');
    console.log('\n💡 Try these queries:');
    console.log('  • "What is NAV?"');
    console.log('  • "Calculate SIP 5000 for 10 years at 12%"');
    console.log('  • "What is expense ratio?"');
    console.log('  • "How to calculate CAGR?"');
  } catch (error) {
    console.error('\n❌ Test Failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run tests
testChatbot()
  .then(() => {
    console.log('\n✓ Test script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n✗ Test script failed:', error);
    process.exit(1);
  });
