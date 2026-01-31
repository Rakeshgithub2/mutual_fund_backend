import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env
config({ path: resolve(__dirname, '../../.env') });

const apiKey = process.env.GEMINI_API_KEY;
console.log(
  'API Key loaded:',
  apiKey
    ? `${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 5)}`
    : 'NOT FOUND'
);

async function testGeminiAPI() {
  if (!apiKey) {
    console.error('❌ No API key found!');
    return;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  console.log('\n🧪 Testing Gemini API...');
  console.log('URL:', url.replace(apiKey, 'API_KEY_HIDDEN'));

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Say hello in one word' }] }],
      }),
    });

    const data: any = await response.json();
    console.log('\n📬 Raw Response:', JSON.stringify(data, null, 2));

    if (data.error) {
      console.error('\n❌ API Error:', data.error.message);
      console.log('\nPossible causes:');
      console.log('1. API key is invalid or expired');
      console.log('2. API key does not have access to Gemini API');
      console.log('3. Billing not enabled on Google Cloud project');
      console.log(
        '\nTo fix: Go to https://aistudio.google.com/app/apikey and generate a new key'
      );
    } else {
      console.log('\n✅ API is working!');
      console.log(
        'Response:',
        data?.candidates?.[0]?.content?.parts?.[0]?.text
      );
    }
  } catch (err) {
    console.error('Network error:', err);
  }
}

testGeminiAPI();
