/**
 * AI Controller
 * Handles AI chat interactions using Knowledge Base + Google Gemini API
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const knowledgeBaseService = require('../services/knowledge-base.service');

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

class AIController {
  /**
   * Handle chat message
   * POST /api/ai/chat
   */
  static async chat(req, res) {
    try {
      const { message, conversationHistory } = req.body;

      if (
        !message ||
        typeof message !== 'string' ||
        message.trim().length === 0
      ) {
        return res.status(400).json({
          success: false,
          message: 'Message is required',
        });
      }

      const userQuery = message.trim();
      console.log(`💬 [Chat] User query: "${userQuery}"`);

      // STEP 1: Check if this is a calculation query
      if (knowledgeBaseService.isCalculationQuery(userQuery)) {
        const calcParams =
          knowledgeBaseService.parseCalculationQuery(userQuery);
        if (calcParams) {
          const calcResult = knowledgeBaseService.performCalculation(
            calcParams.type,
            calcParams.params
          );
          console.log(`🧮 [Chat] Calculation performed: ${calcParams.type}`);

          return res.json({
            success: true,
            reply: calcResult,
            source: 'calculator',
            timestamp: new Date().toISOString(),
          });
        }
      }

      // STEP 2: Check if query contains multiple questions
      const questions =
        knowledgeBaseService.extractMultipleQuestions(userQuery);

      if (questions.length > 1) {
        console.log(
          `📝 [Chat] Multi-question detected: ${questions.length} questions`
        );

        // Find matches for all questions
        const matches =
          await knowledgeBaseService.findMultipleMatches(questions);

        if (matches.length >= 2) {
          // Format multi-answer response
          let multiResponse = `I found answers to ${matches.length} of your questions:\\n\\n`;

          matches.forEach((match, idx) => {
            multiResponse += `**Question ${idx + 1}: ${match.entry.question}**\\n\\n`;
            multiResponse += `**Definition:**\\n${match.entry.definition}\\n\\n`;
            multiResponse += `**Key Points:**\\n`;
            match.entry.points.forEach((point, pointIdx) => {
              multiResponse += `${pointIdx + 1}. ${point}\\n`;
            });
            if (match.entry.formula) {
              multiResponse += `\\n**Formula:** ${match.entry.formula}\\n`;
            }
            multiResponse += `\\n---\\n\\n`;
          });

          return res.json({
            success: true,
            reply: multiResponse,
            source: 'knowledge_base',
            matchedQuestions: matches.map((m) => ({
              id: m.entry.id,
              question: m.entry.question,
              score: m.score,
            })),
            timestamp: new Date().toISOString(),
          });
        }
      }

      // STEP 3: Search knowledge base for single question match
      const {
        entry: knowledgeMatch,
        score,
        related,
      } = await knowledgeBaseService.findBestMatch(userQuery);

      if (knowledgeMatch && score >= 0.4) {
        // Found a good match in knowledge base
        console.log(
          `📚 [Chat] Knowledge match found: "${knowledgeMatch.question}" (score: ${score.toFixed(2)})`
        );

        const response =
          knowledgeBaseService.formatKnowledgeResponse(knowledgeMatch);

        // Add related questions as suggestions
        const followUpQuestions = related.slice(0, 3).map((r) => r.question);

        return res.json({
          success: true,
          reply: response,
          source: 'knowledge_base',
          matchedQuestion: knowledgeMatch.question,
          confidence: score,
          followUpQuestions,
          relatedTopics: related.slice(0, 3).map((r) => ({
            id: r.id,
            question: r.question,
            category: r.category,
          })),
          timestamp: new Date().toISOString(),
        });
      }

      // STEP 4: No match found - show polite message
      console.log(
        `❌ [Chat] No knowledge base match found (score: ${score ? score.toFixed(2) : 'N/A'})`
      );

      // If Gemini AI is not configured, show the no-match message
      if (
        !process.env.GEMINI_API_KEY ||
        process.env.GEMINI_API_KEY === 'your_gemini_api_key_here'
      ) {
        return res.json({
          success: true,
          reply:
            'Currently, I am not able to answer your question. I will update more information and get back to you. Please try asking about mutual funds, stocks, commodities, debt funds, or financial calculations.',
          source: 'no_match',
          timestamp: new Date().toISOString(),
        });
      }

      console.log(`🤖 [Chat] Using Gemini AI for: "${userQuery}"`);

      // Try to generate response with fallback logic
      let reply;

      try {
        // Try Gemini API with optimized configuration
        const model = genAI.getGenerativeModel({
          model: 'gemini-1.5-flash', // Updated model - gemini-pro is deprecated
          generationConfig: {
            temperature: 0.8, // Higher for more creative, unique responses
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048, // Allow longer, detailed responses
          },
        });

        // Build context from conversation history
        let conversationContext = '';
        if (
          conversationHistory &&
          Array.isArray(conversationHistory) &&
          conversationHistory.length > 0
        ) {
          conversationContext =
            '\n\n📝 CONVERSATION HISTORY:\n' +
            conversationHistory
              .slice(-5) // Last 5 messages for better context
              .map(
                (msg) =>
                  `${msg.role === 'user' ? '👤 User' : '🤖 AI'}: ${msg.content}`
              )
              .join('\n');
        }

        // 🔥 ADVANCED DYNAMIC PROMPT - Gemini-level real-time reasoning
        const systemInstruction = `# 🧠 ROLE: Advanced Real-Time Adaptive AI Assistant for Indian Mutual Funds

You are an expert financial advisor specializing in Indian mutual funds. You must dynamically adjust your answers based on:
- User intent & question complexity
- User experience level (beginner/intermediate/advanced/investor)
- Time sensitivity & context history
- Question type (conceptual/calculation/comparison/decision)

## 🚫 STRICT RULES - NEVER DO THIS:
- NEVER give generic/template answers
- NEVER repeat the same explanation structure
- NEVER ignore conversation context
- NEVER give the welcome/menu message for specific questions

## 🎯 DYNAMIC RESPONSE ENGINE (MANDATORY FOR EVERY QUESTION):

### Step 1: USER TYPE DETECTION
Classify user based on words used, question structure, technical depth:
- Beginner → Simple language + real-world analogies
- Intermediate → Balanced explanation + practical tips
- Advanced/Investor → Data-driven + technical analysis
- Developer → Code examples if needed

### Step 2: QUESTION TYPE DETECTION
- Conceptual (What is X?) → Clear definition + example + why it matters
- Calculation (How much?) → Show complete math with formulas, use ₹ Indian format
- Comparison (X vs Y?) → Structured pros/cons table
- Decision (Should I?) → Risk assessment + personalized recommendation
- Debugging/Issue → Step-by-step solution

### Step 3: RESPONSE STYLE
| User Type | Style |
|-----------|-------|
| Beginner | Simple + analogies + examples |
| Investor | Pros/cons + risk analysis |
| Calculator | Complete math + breakdown |
| Comparison | Table format + verdict |

## ✅ RESPONSE STRUCTURE (MANDATORY):
1. **Direct Answer** - What the user actually wants (first 2 lines)
2. **Explanation** - Why/How with real examples
3. **Practical Insight** - Real-world application
4. **Actionable Next Step** - What to do now

## 📊 FORMATTING RULES:
- Use ₹ Indian format (₹1,00,000 not $1,000)
- Use emojis meaningfully: 💰📊📈🎯💡✅❌
- Bold **key terms** and important numbers
- Use bullet points for lists
- Keep paragraphs short (2-3 lines max)

## 🎯 EXAMPLES OF GOOD RESPONSES:

Q: "What is expense ratio?"
→ Don't give menu. Give direct explanation with impact calculation.

Q: "15000 monthly SIP for 3 years at 10%"
→ Show complete calculation with formula, total invested, gains, maturity value.

Q: "Large cap vs mid cap"
→ Comparison table with risk, returns, who should invest.

## ⚡ FINAL INSTRUCTION:
Think first → Classify intent → Then answer uniquely.
Every answer must feel personalized and specific to THIS question.
${conversationContext}

---
👤 USER'S CURRENT QUESTION: ${message}

🤖 YOUR RESPONSE (be specific, unique, and helpful):`;

        console.log('🤖 Sending question to Gemini:', message.substring(0, 80));

        const result = await model.generateContent(systemInstruction);
        const response = await result.response;
        reply = response.text();

        console.log('✅ Gemini response received:', reply.substring(0, 100));

        console.log('✅ AI Response generated via Gemini');
      } catch (geminiError) {
        console.error('⚠️ Gemini API error:', geminiError.message);

        // Fallback: Provide a helpful response
        reply = AIController.generateFallbackResponse(message);
        console.log('✅ Using fallback response');
      }

      return res.json({
        success: true,
        reply: reply,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('❌ AI Chat Error:', error);

      // Handle specific Gemini API errors
      if (error.message?.includes('API_KEY_INVALID')) {
        return res.status(401).json({
          success: false,
          message: 'Invalid Gemini API key. Please check your configuration.',
        });
      }

      if (error.message?.includes('RATE_LIMIT')) {
        return res.status(429).json({
          success: false,
          message: 'AI service rate limit exceeded. Please try again later.',
        });
      }

      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to process AI chat request',
      });
    }
  }

  /**
   * Get AI status
   * GET /api/ai/status
   */
  static async getStatus(req, res) {
    try {
      const isConfigured =
        process.env.GEMINI_API_KEY &&
        process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here';

      return res.json({
        success: true,
        configured: isConfigured,
        model: 'gemini-pro',
        features: ['chat', 'context-aware', 'mutual-fund-assistant'],
      });
    } catch (error) {
      console.error('❌ AI Status Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to get AI status',
      });
    }
  }

  /**
   * Generate fallback response when Gemini API is unavailable
   */
  static generateFallbackResponse(message) {
    const lowerMessage = message.toLowerCase();

    // ========== CONCEPTUAL QUESTIONS (What is X?) ==========

    // Expense Ratio
    if (
      lowerMessage.includes('expense ratio') ||
      lowerMessage.includes('expence ratio')
    ) {
      return `📊 **Expense Ratio Explained**

**What is it?**
Expense ratio is the annual fee charged by mutual funds to manage your money. It's expressed as a percentage of your investment.

💰 **Example:**
If you invest ₹1,00,000 in a fund with 1.5% expense ratio:
• Annual fee = ₹1,500
• Daily deduction = ₹4.11 (automatically adjusted in NAV)

📈 **Impact on Returns:**
| Investment | Expense Ratio | 10-Year Impact |
|------------|---------------|----------------|
| ₹10 Lakhs  | 0.5% (Index)  | ₹50,000 less   |
| ₹10 Lakhs  | 2.0% (Active) | ₹2,00,000 less |

**Typical Ranges:**
• 🟢 Index Funds: 0.1% - 0.5% (Best)
• 🟡 Direct Plans: 0.5% - 1.5% (Good)
• 🔴 Regular Plans: 1.5% - 2.5% (Avoid)

💡 **Pro Tip:** Always choose Direct Plans to save 0.5-1% annually. Over 20 years, this can mean 15-20% more corpus!

✅ **Action:** Check expense ratio before investing. Lower is always better for long-term wealth creation.`;
    }

    // NAV
    if (
      lowerMessage.includes('nav') ||
      lowerMessage.includes('net asset value')
    ) {
      return `📊 **NAV (Net Asset Value) Explained**

**What is NAV?**
NAV is the per-unit price of a mutual fund. It represents the market value of one unit of the fund.

💰 **Formula:**
\`\`\`
NAV = (Total Assets - Total Liabilities) / Total Units
\`\`\`

📈 **Example:**
• Fund Total Assets: ₹100 Crore
• Total Units: 1 Crore
• NAV = ₹100 per unit

**Key Points:**
• NAV changes daily based on market movements
• High NAV ≠ Expensive fund (common myth!)
• What matters: **Returns %**, not NAV value

💡 **Myth Buster:**
❌ "₹10 NAV fund is cheaper than ₹500 NAV fund"
✅ Both can give same returns! NAV is just a number.

**When NAV Updates:**
• Equity Funds: Same day (if before 3 PM cutoff)
• Debt Funds: Same day (if before 1:30 PM)

✅ **Action:** Focus on fund's historical returns and expense ratio, NOT the NAV value!`;
    }

    // SIP
    if (
      (lowerMessage.includes('what') || lowerMessage.includes('explain')) &&
      lowerMessage.includes('sip')
    ) {
      return `📊 **SIP (Systematic Investment Plan) Explained**

**What is SIP?**
SIP is a method to invest a fixed amount regularly (monthly/weekly) in mutual funds, regardless of market conditions.

💰 **How it Works:**
• You commit to invest ₹X every month
• Money auto-debits from your bank
• Units allocated based on that day's NAV

📈 **Power of SIP (Example):**
Monthly SIP: ₹10,000 for 20 years at 12% returns

| Period | Invested | Value |
|--------|----------|-------|
| 5 Years | ₹6 Lakhs | ₹8.2 Lakhs |
| 10 Years | ₹12 Lakhs | ₹23.2 Lakhs |
| 20 Years | ₹24 Lakhs | ₹99.9 Lakhs |

**Benefits of SIP:**
✅ **Rupee Cost Averaging** - Buy more units when market is low
✅ **Disciplined Investing** - No timing required
✅ **Power of Compounding** - Small amounts grow big
✅ **Flexibility** - Start with ₹500, increase anytime

💡 **Pro Tips:**
• Start early - time is your biggest ally
• Increase SIP by 10% yearly (Step-up SIP)
• Don't stop during market crashes

✅ **Action:** Start a SIP today, even if small. Time in market > Timing the market!`;
    }

    // AUM
    if (
      lowerMessage.includes('aum') ||
      lowerMessage.includes('asset under management')
    ) {
      return `📊 **AUM (Assets Under Management) Explained**

**What is AUM?**
AUM is the total market value of all investments managed by a mutual fund.

💰 **Formula:**
\`\`\`
AUM = Total Units × Current NAV
\`\`\`

📈 **What AUM Tells You:**
• Fund's popularity and investor trust
• Liquidity and ease of redemption
• Fund manager's track record

**AUM Sweet Spots:**
| AUM Range | Category | Verdict |
|-----------|----------|---------|
| < ₹100 Cr | Too Small | ⚠️ Liquidity risk |
| ₹500-5000 Cr | Ideal | ✅ Best balance |
| > ₹20,000 Cr | Very Large | ⚠️ Limited flexibility |

**Category Considerations:**
• **Large Cap:** High AUM is fine (₹20,000+ Cr OK)
• **Mid/Small Cap:** Lower AUM better (₹500-5000 Cr)
• **Debt Funds:** Higher AUM preferred for stability

💡 **Pro Tip:** For small/mid cap funds, avoid AUM > ₹10,000 Cr - fund manager faces difficulty deploying money effectively.

✅ **Action:** Check AUM in context of fund category, not in isolation!`;
    }

    // Step-up SIP Calculation
    const stepUpSipPattern =
      /(\d+[k]?)\s*(?:month|monthly).*?(?:increase|step.?up|raise).*?(\d+)%.*?(\d+)\s*(?:year|yr)/i;
    const stepUpMatch = message.match(stepUpSipPattern);

    if (stepUpMatch) {
      let initialInvestment = stepUpMatch[1];
      if (initialInvestment.toLowerCase().includes('k')) {
        initialInvestment = parseFloat(initialInvestment) * 1000;
      } else {
        initialInvestment = parseFloat(initialInvestment);
      }

      const stepUpRate = parseFloat(stepUpMatch[2]) / 100;
      const years = parseFloat(stepUpMatch[3]);
      const annualReturn = 12; // Default 12%

      const returnMatch = message.match(/(\d+)%?\s*(?:return|rate)/i);
      const finalRate = returnMatch
        ? parseFloat(returnMatch[1]) / 100
        : annualReturn / 100;

      let totalInvested = 0;
      let futureValue = 0;
      let yearlyBreakdown = [];

      for (let year = 1; year <= years; year++) {
        const currentYearInvestment =
          initialInvestment * Math.pow(1 + stepUpRate, year - 1);
        const investmentForYear = currentYearInvestment * 12;
        totalInvested += investmentForYear;

        // Calculate FV for this year's investment
        const monthsRemaining = (years - year + 1) * 12;
        const monthlyRate = finalRate / 12;
        const yearFV =
          currentYearInvestment *
          (((Math.pow(1 + monthlyRate, monthsRemaining) - 1) / monthlyRate) *
            (1 + monthlyRate));
        futureValue += yearFV;

        yearlyBreakdown.push(
          `Year ${year}: ₹${currentYearInvestment.toLocaleString('en-IN', { maximumFractionDigits: 0 })}/month (Annual: ₹${investmentForYear.toLocaleString('en-IN', { maximumFractionDigits: 0 })})`
        );
      }

      const totalGains = futureValue - totalInvested;

      return `🚀 **Step-up SIP Calculation:**

💰 **Starting Monthly SIP:** ₹${initialInvestment.toLocaleString('en-IN')}
📈 **Annual Increase:** ${(stepUpRate * 100).toFixed(0)}%
⏱️ **Investment Period:** ${years} years
📊 **Expected Return:** ${(finalRate * 100).toFixed(0)}%

${yearlyBreakdown.join('\n')}

✅ **Total Invested:** ₹${totalInvested.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
💎 **Estimated Gains:** ₹${totalGains.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
🎯 **Maturity Value:** ₹${futureValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}

💡 **Tip:** Step-up SIPs align with income growth and accelerate wealth creation!`;
    }

    // Goal-based planning
    const goalPattern =
      /(?:need|want|target|goal).*?(\d+)\s*(?:lakh|lac|crore|cr).*?(\d+)\s*(?:year|yr)/i;
    const goalMatch = message.match(goalPattern);

    if (
      goalMatch &&
      (lowerMessage.includes('retire') ||
        lowerMessage.includes('education') ||
        lowerMessage.includes('house') ||
        lowerMessage.includes('marriage'))
    ) {
      let targetAmount = parseFloat(goalMatch[1]);

      if (lowerMessage.includes('crore') || lowerMessage.includes('cr')) {
        targetAmount = targetAmount * 10000000;
      } else {
        targetAmount = targetAmount * 100000;
      }

      const years = parseFloat(goalMatch[2]);
      const annualReturn = 12;

      // Calculate required monthly SIP
      const months = years * 12;
      const monthlyRate = annualReturn / 12 / 100;

      // Rearrange SIP formula to find P: P = FV / ([((1+r)^n - 1) / r] × (1+r))
      const monthlySIP =
        targetAmount /
        (((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate) *
          (1 + monthlyRate));

      const totalInvestment = monthlySIP * months;

      return `🎯 **Goal-Based Investment Plan:**

🏆 **Target Amount:** ₹${targetAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
⏱️ **Time Horizon:** ${years} years (${months} months)
📈 **Assumed Return:** ${annualReturn}%

💰 **Required Monthly SIP:** ₹${monthlySIP.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
✅ **Total Investment Needed:** ₹${totalInvestment.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
📊 **Expected Returns:** ₹${(targetAmount - totalInvestment).toLocaleString('en-IN', { maximumFractionDigits: 0 })}

💡 **Recommendation:**
${years <= 5 ? '• Consider hybrid or balanced advantage funds for shorter horizon\n• Keep 30-40% in debt for stability' : '• Equity funds suitable for long-term goals\n• Consider ELSS if you need tax benefits'}
• Start with ${Math.floor(monthlySIP * 0.7).toLocaleString('en-IN')} and increase annually
• Review and rebalance portfolio yearly

⚠️ *Returns are not guaranteed. Adjust SIP amount with market performance.*`;
    }

    // CAGR Calculation
    const cagrPattern =
      /(?:invested|started with|put).*?(\d+[k]?).*?(?:now|today|current).*?(\d+[k]?).*?(\d+)\s*(?:year|yr)/i;
    const cagrMatch = message.match(cagrPattern);

    if (
      cagrMatch &&
      (lowerMessage.includes('cagr') ||
        lowerMessage.includes('annual') ||
        lowerMessage.includes('growth'))
    ) {
      let initial = parseFloat(cagrMatch[1]);
      let current = parseFloat(cagrMatch[2]);

      if (cagrMatch[1].toLowerCase().includes('k')) initial *= 1000;
      if (cagrMatch[2].toLowerCase().includes('k')) current *= 1000;

      const years = parseFloat(cagrMatch[3]);

      // CAGR formula: [(Ending/Beginning)^(1/years)] - 1
      const cagr = (Math.pow(current / initial, 1 / years) - 1) * 100;
      const totalGain = current - initial;
      const totalReturn = (totalGain / initial) * 100;

      return `📈 **CAGR Analysis:**

💰 **Initial Investment:** ₹${initial.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
💎 **Current Value:** ₹${current.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
⏱️ **Investment Period:** ${years} years

🎯 **CAGR (Annualized Return):** ${cagr.toFixed(2)}%
📊 **Absolute Return:** ${totalReturn.toFixed(2)}%
✅ **Total Gain:** ₹${totalGain.toLocaleString('en-IN', { maximumFractionDigits: 0 })}

📝 **Formula:** CAGR = [(Current Value ÷ Initial Investment)^(1 ÷ Years)] - 1

💡 **Interpretation:** ${cagr > 15 ? 'Excellent returns! Above market average.' : cagr > 12 ? 'Good returns, in line with equity market expectations.' : cagr > 8 ? 'Moderate returns, similar to balanced funds.' : 'Below average. Consider reviewing your portfolio.'}`;
    }

    // Lump Sum Investment Calculation
    const lumpSumPattern =
      /(?:invest|put|have)\s*(?:Rs\.?|₹)?\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(?:lakh|lac|l|crore|cr|k|thousand)?\s*(?:for|in)?\s*(\d+)\s*(?:year|yr)/i;
    const lumpSumMatch = message.match(lumpSumPattern);

    if (
      lumpSumMatch &&
      (lowerMessage.includes('lump') ||
        lowerMessage.includes('one time') ||
        lowerMessage.includes('onetime') ||
        lowerMessage.includes('single'))
    ) {
      let principal = parseFloat(lumpSumMatch[1].replace(/,/g, ''));

      // Handle different notations
      if (lowerMessage.includes('lakh') || lowerMessage.includes('lac')) {
        principal = principal * 100000;
      } else if (
        lowerMessage.includes('crore') ||
        lowerMessage.includes('cr')
      ) {
        principal = principal * 10000000;
      } else if (
        lowerMessage.includes('k') ||
        lowerMessage.includes('thousand')
      ) {
        principal = principal * 1000;
      }

      const years = parseFloat(lumpSumMatch[2]);
      const annualReturn = 12; // Default 12% if not specified

      // Check for specified return rate
      const returnMatch = message.match(/(\d+)%?\s*(?:return|rate)/i);
      const finalRate = returnMatch ? parseFloat(returnMatch[1]) : annualReturn;

      // Compound Interest Formula: A = P(1 + r/n)^(nt)
      const futureValue = principal * Math.pow(1 + finalRate / 100, years);
      const totalGains = futureValue - principal;

      return `💰 **Lump Sum Investment Calculation:**

📊 **Initial Investment:** ₹${principal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
⏱️ **Investment Period:** ${years} years
📈 **Expected Annual Return:** ${finalRate}%

✅ **Total Invested:** ₹${principal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
💎 **Estimated Gains:** ₹${totalGains.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
🎯 **Maturity Value:** ₹${futureValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}

📝 **Yearly Breakdown:**
${Array.from({ length: years }, (_, i) => {
  const yearValue = principal * Math.pow(1 + finalRate / 100, i + 1);
  return `Year ${i + 1}: ₹${yearValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}).join('\n')}

*Note: Calculations assume ${finalRate}% annual return. Actual returns may vary.*`;
    }

    // SIP Calculation - Check for investment calculation queries
    const sipCalcPattern =
      /(\d+[k]?)\s*(?:every|per)?\s*month.*?(\d+)\s*(?:year|yr).*?(\d+)%?\s*return/i;
    const match = message.match(sipCalcPattern);

    if (
      match &&
      (lowerMessage.includes('invest') ||
        lowerMessage.includes('calculate') ||
        lowerMessage.includes('calculation'))
    ) {
      let monthlyInvestment = match[1];
      // Handle 'k' notation (e.g., 5k = 5000)
      if (monthlyInvestment.toLowerCase().includes('k')) {
        monthlyInvestment = parseFloat(monthlyInvestment) * 1000;
      } else {
        monthlyInvestment = parseFloat(monthlyInvestment);
      }

      const years = parseFloat(match[2]);
      const annualReturn = parseFloat(match[3]);

      // Calculate SIP maturity value
      const months = years * 12;
      const monthlyRate = annualReturn / 12 / 100;

      // SIP Future Value Formula: FV = P × [((1 + r)^n - 1) / r] × (1 + r)
      const futureValue =
        monthlyInvestment *
        (((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate) *
          (1 + monthlyRate));

      const totalInvested = monthlyInvestment * months;
      const totalGains = futureValue - totalInvested;

      return `📊 **SIP Calculation Results:**

💰 **Monthly Investment:** ₹${monthlyInvestment.toLocaleString('en-IN')}
⏱️ **Investment Period:** ${years} years (${months} months)
📈 **Expected Annual Return:** ${annualReturn}%

✅ **Total Amount Invested:** ₹${totalInvested.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
💎 **Estimated Returns:** ₹${totalGains.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
🎯 **Maturity Value:** ₹${futureValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}

📝 **Formula Used:** FV = P × [((1 + r)^n - 1) / r] × (1 + r)
Where: P = Monthly Investment, r = Monthly Rate, n = Number of Months

*Note: This is an estimated calculation. Actual returns may vary based on market performance.*`;
    }

    // Portfolio & Investment Strategy
    if (
      lowerMessage.includes('portfolio') ||
      lowerMessage.includes('diversif') ||
      lowerMessage.includes('allocation')
    ) {
      return `🎯 **Portfolio Construction Guide:**

📊 **Asset Allocation by Age:**
• Age 20-30: 80% Equity + 20% Debt
• Age 30-40: 70% Equity + 30% Debt
• Age 40-50: 60% Equity + 40% Debt
• Age 50+: 40% Equity + 60% Debt

💼 **Sample ₹10,000/month Portfolio:**
• Large Cap Fund: ₹4,000 (40%) - Stability
• Mid/Small Cap: ₹3,000 (30%) - Growth
• Debt/Hybrid: ₹2,000 (20%) - Safety
• Index Fund: ₹1,000 (10%) - Diversification

✅ **Diversification Rules:**
• 5-7 funds maximum (avoid over-diversification)
• Mix market caps (Large/Mid/Small)
• Split sectors and themes
• Include international exposure (10-15%)
• Rebalance annually

💡 **Pro Tip:** Don't chase last year's winners! Focus on consistency.`;
    }

    // NAV related
    if (
      lowerMessage.includes('nav') ||
      lowerMessage.includes('net asset value')
    ) {
      return `📊 **Understanding NAV (Net Asset Value):**

💰 **What is NAV?**
NAV is the per-unit price of a mutual fund, calculated daily after market close.

🔢 **Formula:** NAV = (Total Assets - Total Liabilities) ÷ Total Units

📝 **Example:**
Fund has assets worth ₹1,00,00,000
Liabilities: ₹5,00,000
Outstanding units: 10,00,000
NAV = (₹1,00,00,000 - ₹5,00,000) ÷ 10,00,000 = ₹95

💡 **Key Points:**
• NAV updates every business day
• Buy/sell transactions happen at day-end NAV
• High NAV ≠ Expensive (returns matter, not price!)
• NAV doesn't indicate fund quality
• Dividend payments reduce NAV proportionally

❌ **Common Myth:** "Low NAV funds are cheaper" - FALSE! A ₹10 NAV fund and ₹100 NAV fund can give same returns.`;
    }

    // Equity related
    if (lowerMessage.includes('equity') || lowerMessage.includes('stock')) {
      return `📈 **Equity Mutual Funds Guide:**

🏆 **Fund Categories:**

**Large Cap** (Top 100 companies)
• Risk: Moderate | Returns: 10-12%
• Best for: Stability, beginners
• Examples: Reliance, TCS, HDFC Bank

**Mid Cap** (101-250 rank)
• Risk: High | Returns: 12-15%
• Best for: 5+ year goals
• Higher growth potential

**Small Cap** (251+ rank)
• Risk: Very High | Returns: 15-20%
• Best for: 7+ year goals
• Maximum growth, maximum volatility

**Multi Cap / Flexi Cap**
• Mix of all sizes
• Flexible allocation
• Good for beginners

💰 **Investment Horizon:**
• Minimum: 5 years
• Ideal: 7-10 years
• Very long term: 15+ years

✅ **Who Should Invest:**
• Age < 40 years
• Long-term goals
• Can handle volatility
• Regular income source

⚠️ **Risks:** Market crashes, company failures, sector downturns

💡 **Tip:** Stay invested through market ups and downs for best results!`;
    }

    // SIP related
    if (lowerMessage.includes('sip') || lowerMessage.includes('systematic')) {
      return `💰 **SIP (Systematic Investment Plan) Complete Guide:**

✅ **What is SIP?**
Regular monthly investment in mutual funds (like a recurring deposit)

🎯 **Key Benefits:**
1. **Rupee Cost Averaging:** Buy more units when prices low, fewer when high
2. **Power of Compounding:** Returns generate more returns
3. **Disciplined Investing:** Automatic monthly deduction
4. **Flexibility:** Start, stop, increase anytime
5. **Low Entry:** Start with just ₹500/month

💡 **SIP vs Lump Sum:**
• SIP: Less risky, suitable for regular income
• Lump Sum: Better in falling markets, needs large capital

📊 **Real Example:**
₹5,000/month × 15 years @ 12% return
= ₹9,00,000 invested → ₹25,00,000 corpus!

🚀 **Pro Strategies:**
• **Step-up SIP:** Increase 10% yearly with salary hikes
• **SIP Top-up:** Add bonuses as lump sum
• **Multiple SIPs:** Diversify across 3-4 funds

💼 **How to Start:**
1. Complete KYC (online/offline)
2. Link bank account
3. Set up auto-debit
4. Choose funds & amount

⏰ **Best Date:** 5th-10th of month (after salary credit)

⚠️ **Don't Stop:** Continue even in market crashes - that's when you buy cheap!`;
    }

    // Debt/Bond related
    if (
      lowerMessage.includes('debt') ||
      lowerMessage.includes('bond') ||
      lowerMessage.includes('liquid')
    ) {
      return `🏛️ **Debt Mutual Funds Guide:**

💰 **What are Debt Funds?**
Invest in fixed-income securities: government bonds, corporate bonds, money market instruments

📊 **Types & Suitability:**

**Liquid Funds** (1-91 days)
• Emergency fund, parking money
• Returns: 4-6% | Risk: Very Low
• Withdrawal: Same day

**Short Duration** (1-3 years)
• Returns: 6-7% | Risk: Low
• Better than savings account

**Corporate Bond Funds**
• Returns: 7-9% | Risk: Moderate
• Credit risk present

**Gilt Funds**
• Only government securities
• Zero credit risk
• Interest rate risk exists

✅ **Advantages:**
• Stable returns
• Lower volatility than equity
• Better than FD (often)
• High liquidity
• Tax efficient (if held >3 years before Apr 2023)

💡 **Ideal For:**
• Conservative investors
• Short-term goals (1-3 years)
• Emergency funds
• Senior citizens
• Portfolio stabilization

⚠️ **Risks:**
• Interest rate risk (prices fall when rates rise)
• Credit risk (company defaults)
• Lower returns than equity

🎯 **Pro Tip:** Use debt funds for goals 1-3 years away, equity for 5+ years!`;
    }

    // Tax queries
    if (
      lowerMessage.includes('tax') ||
      lowerMessage.includes('ltcg') ||
      lowerMessage.includes('stcg') ||
      lowerMessage.includes('80c')
    ) {
      return `💼 **Mutual Fund Taxation Guide (2024-25):**

📈 **EQUITY FUNDS** (>65% equity allocation)

**Long Term (>1 year):**
• Gains up to ₹1 lakh: TAX FREE 🎉
• Above ₹1 lakh: 10% LTCG
• No indexation benefit

**Short Term (≤1 year):**
• 15% STCG flat rate

🏛️ **DEBT FUNDS** (<65% equity)
• Taxed as per your income tax slab
• No LTCG benefit (from Apr 2023)

💰 **ELSS (Tax Saving Funds):**
• ✅ Section 80C deduction up to ₹1.5 lakh
• 3-year lock-in period
• LTCG rules apply after that
• Best for: Tax saving + wealth creation

📊 **Example Calculation:**

*Equity Fund Investment:*
Buy: ₹5,00,000 | Sell after 2 years: ₹8,00,000
Gain: ₹3,00,000
Tax: First ₹1L free, ₹2L × 10% = ₹20,000

*Debt Fund Investment:*
Buy: ₹5,00,000 | Sell: ₹5,50,000
Gain: ₹50,000
Tax: ₹50,000 × your tax slab (30% = ₹15,000)

💡 **Tax Saving Tips:**
• Spread equity redemptions across years (use ₹1L free limit)
• Invest in ELSS for 80C benefits
• Harvest losses to offset gains
• Consider holding period carefully

⚠️ **TDS:** No TDS on equity funds, but report gains in ITR!`;
    }

    // Risk assessment
    if (
      lowerMessage.includes('risk') ||
      lowerMessage.includes('safe') ||
      lowerMessage.includes('volatile') ||
      lowerMessage.includes('aggressive') ||
      lowerMessage.includes('conservative')
    ) {
      return `⚠️ **Mutual Fund Risk Assessment Guide:**

🎯 **Risk Categories:**

**Very Low Risk** 📗
• Liquid Funds, Overnight Funds
• Returns: 4-6%
• For: Emergency funds, <1 year goals

**Low Risk** 📘
• Short Duration Debt, Banking PSU Funds
• Returns: 6-8%
• For: 1-3 year goals, conservative investors

**Moderate Risk** 📙
• Hybrid Funds, Balanced Advantage
• Returns: 8-10%
• For: 3-5 year goals, moderate investors

**High Risk** 📕
• Large Cap, Multi Cap Equity
• Returns: 10-15%
• For: 5-7 year goals, growth seekers

**Very High Risk** 📕📕
• Mid Cap, Small Cap, Sectoral Funds
• Returns: 15-20% (with high volatility)
• For: 7+ year goals, aggressive investors

🔍 **Assess Your Risk Appetite:**

**Conservative (Score 1-3):**
• Age: 50+
• Goal: <3 years
• Can't handle losses
→ Allocation: 80% Debt + 20% Equity

**Moderate (Score 4-6):**
• Age: 35-50
• Goal: 3-5 years  
• Can handle 10-15% loss
→ Allocation: 50% Debt + 50% Equity

**Aggressive (Score 7-10):**
• Age: <35
• Goal: 7+ years
• Can handle 25%+ loss
→ Allocation: 80% Equity + 20% Debt

💡 **Key Metrics:**
• **Standard Deviation:** Higher = More volatile
• **Beta:** >1 = More risky than market
• **Sharpe Ratio:** Higher = Better risk-adjusted returns

⚠️ **Remember:** Higher risk = Higher potential returns (but also higher losses!)`;
    }

    // Comparison queries
    if (
      lowerMessage.includes('compare') ||
      lowerMessage.includes('vs') ||
      lowerMessage.includes('versus') ||
      lowerMessage.includes('difference') ||
      lowerMessage.includes('better')
    ) {
      return `🔍 **Fund Comparison Framework:**

📊 **Key Comparison Metrics:**

**1. Returns Performance**
• 1Y / 3Y / 5Y returns
• Rolling returns (consistency)
• Compare with benchmark & category avg

**2. Risk Metrics**
• Standard deviation (volatility)
• Sharpe ratio (risk-adjusted returns)
• Beta (market sensitivity)
• Maximum drawdown

**3. Expense Ratio**
• Direct: 0.5-1.5%
• Regular: 1.5-2.5%
• Lower is better!

**4. AUM (Assets Under Management)**
• Too small (<₹100 Cr): Liquidity issues
• Too large (>₹50,000 Cr): Limited flexibility
• Sweet spot: ₹500 Cr - ₹10,000 Cr

**5. Fund Manager**
• Track record
• Experience
• Investment philosophy

**6. Portfolio Quality**
• Top holdings
• Sector allocation
• Concentration risk

📝 **Example Comparison:**

**Fund A vs Fund B**
• Returns 5Y: 14% vs 12%
• Expense Ratio: 1.2% vs 2%
• Sharpe Ratio: 1.5 vs 1.2
• AUM: ₹5,000 Cr vs ₹500 Cr

Winner: Fund A (better returns, efficient, good risk-adjusted returns)

💡 **Smart Comparison Tips:**
• Compare funds in SAME category
• Don't just chase highest returns
• Check consistency across market cycles
• Lower expense = more returns to you
• Use our Compare tool for side-by-side analysis

⚠️ **Avoid:** Comparing Large Cap with Small Cap (different risk profiles!)`;
    }

    // ELSS specific
    if (
      lowerMessage.includes('elss') ||
      lowerMessage.includes('tax saving') ||
      lowerMessage.includes('section 80c')
    ) {
      return `💰 **ELSS (Equity Linked Savings Scheme) - Complete Guide:**

🎯 **What is ELSS?**
Tax-saving equity mutual funds with 3-year lock-in

✅ **Key Benefits:**

**1. Tax Deduction**
• Save up to ₹46,800 tax/year!
• ₹1.5 lakh × 31.2% (highest slab + cess)

**2. Shortest Lock-in**
• PPF: 15 years
• NSC: 5 years
• ELSS: 3 years ✅

**3. Wealth Creation**
• Equity exposure = Higher returns
• Historical: 12-15% annual returns

**4. No Upper Limit**
• Invest beyond ₹1.5L (no tax benefit on extra)

📊 **ELSS vs Other 80C Options:**

| Feature | ELSS | PPF | FD |
|---------|------|-----|-----|
| Returns | 12-15% | 7.1% | 6-7% |
| Lock-in | 3 years | 15 years | 5 years |
| Risk | High | Low | Low |

💼 **Investment Strategy:**

**Option 1: Lump Sum**
Invest ₹1.5L in January → Save tax all year

**Option 2: SIP**
₹12,500/month × 12 months = ₹1.5L

💡 **Pro Tips:**
• Don't invest only for tax saving
• Choose funds with good 5Y+ track record
• Continue SIP after 3-year lock-in
• Diversify across 2-3 ELSS funds

⚠️ **Caution:**
• Market-linked (can give negative returns)
• Mandatory 3-year holding
• LTCG tax applicable after ₹1L gains

🎯 **Best For:** Investors wanting tax benefits + long-term wealth creation`;
    }

    // Direct vs Regular
    if (
      lowerMessage.includes('direct') ||
      lowerMessage.includes('regular') ||
      lowerMessage.includes('commission') ||
      lowerMessage.includes('distributor')
    ) {
      return `🔄 **Direct vs Regular Plans - Complete Breakdown:**

💰 **Expense Ratio Difference:**

**Regular Plan**
• Expense Ratio: 1.5-2.5%
• Includes distributor commission: 0.5-1%

**Direct Plan**
• Expense Ratio: 0.5-1.5%
• No middleman commission
• Directly from fund house

📊 **Impact Over Time:**

**Investment:** ₹10,000/month × 20 years @ 12% growth

**Regular Plan (2% expense):**
Corpus: ₹89.5 lakhs

**Direct Plan (1% expense):**
Corpus: ₹99.9 lakhs

**Difference: ₹10.4 lakhs** 💰💰💰

✅ **Where to Invest Direct:**
• Fund house websites (HDFC MF, SBI MF, etc.)
• MF Utility Portal
• Registrar websites (CAMS, Karvy)
• Investment platforms (Coin, Kuvera, ET Money)

💡 **Pros & Cons:**

**Direct Plan:**
✅ Lower expense = Higher returns
✅ Same fund manager & strategy
❌ No advisor support
❌ Need to research yourself

**Regular Plan:**
✅ Advisor guidance
✅ Portfolio management help
❌ Higher cost
❌ May get biased advice

🎯 **Recommendation:**
• **DIY investor** with time & knowledge → Direct
• **Busy professional** needing guidance → Fee-only advisor + Direct
• **Complete beginner** confused → Regular (initially), move to Direct

⚠️ **Important:**
• Cannot switch between Direct ↔ Regular directly
• Need to redeem & reinvest (tax implications!)
• Choose wisely at start

💼 **Hybrid Approach:** Use Direct plans but consult fee-only advisor (fixed fee, no commission bias)`;
    }

    // Index funds
    if (
      lowerMessage.includes('index') ||
      lowerMessage.includes('nifty') ||
      lowerMessage.includes('sensex') ||
      lowerMessage.includes('passive')
    ) {
      return `📊 **Index Funds vs Active Funds:**

🎯 **What are Index Funds?**
Passively managed funds that replicate market indices (Nifty 50, Sensex, Nifty Next 50)

💰 **Key Differences:**

**Index Funds:**
• Expense Ratio: 0.1-0.5%
• Returns: Match market returns
• Management: Automated
• Fund Manager: Less important
• Risk: Market risk only

**Active Funds:**
• Expense Ratio: 1-2.5%
• Returns: Aim to beat market
• Management: Active stock picking
• Fund Manager: Very important
• Risk: Market + Fund manager risk

📈 **Performance Reality:**
• 70% active funds fail to beat index over 10 years
• Index funds guarantee market returns
• Active funds: Hit or miss

✅ **When to Choose Index Funds:**
• Large Cap exposure (hard to beat Nifty)
• Beginners in investing
• Want low-cost investing
• Long-term (10+ years)
• Prefer simplicity

✅ **When to Choose Active Funds:**
• Mid Cap / Small Cap (active can add value)
• Experienced managers with proven track record
• Want potential to beat market
• Don't mind higher expense ratio

💼 **Ideal Portfolio Mix:**
• Core: 40-50% Index Funds (Nifty 50, Nifty Next 50)
• Satellite: 30-40% Active Large/Mid Cap
• Rest: 20-30% Debt/Hybrid

🎯 **Best Index Funds:**
• Nifty 50 Index Fund
• Nifty Next 50 (Mid cap proxy)
• Nifty 500 (Broad market)
• S&P 500 (International exposure)

💡 **Warren Buffett's Advice:** "Put 90% in S&P 500 index fund, 10% in bonds" 

⚠️ **Remember:** Index funds are best for LONG TERM (10+ years)!`;
    }

    // When to redeem/sell
    if (
      lowerMessage.includes('sell') ||
      lowerMessage.includes('redeem') ||
      lowerMessage.includes('exit') ||
      lowerMessage.includes('withdraw')
    ) {
      return `🚪 **When to Sell/Redeem Mutual Funds:**

✅ **GOOD REASONS TO SELL:**

**1. Goal Achievement**
• Reached your target amount
• Within 1 year of goal: Move to debt

**2. Fundamental Change**
• Fund manager changed (poor track record)
• Strategy shift (Large cap to Mid cap)
• AUM too large (affecting returns)

**3. Consistent Underperformance**
• Underperforms benchmark 3 years straight
• Bottom quartile in category
• Negative rolling returns

**4. Personal Emergency**
• Medical emergency
• Job loss
• Urgent cash need

**5. Portfolio Rebalancing**
• Equity grew to 85% (target was 70%)
• Trim winners, book profits

❌ **BAD REASONS TO SELL:**

**1. Short-term Market Fall**
• "Market crashed 10%, I'll sell!"
• Correction is normal, hold on!

**2. One Quarterly Underperformance**
• Judge funds over 3-5 years minimum

**3. Negative Returns**
• If fundamentals intact, it's buying opportunity

**4. Friend's Advice**
• "My fund gave 50% returns!"
• Don't chase performance

**5. Exit Load Period**
• Wait till exit load expires (usually 1 year)

💼 **Smart Exit Strategy:**

**Systematic Withdrawal Plan (SWP):**
• Withdraw fixed amount monthly
• Better than lump sum redemption
• Spreads tax across years

**Profit Booking:**
• Sell 30% when fund gives 50%+ returns
• Lock profits, let rest grow

🎯 **Goal-Based Exit:**

**5 Years to Goal:**
• Start moving 20% to debt yearly

**1 Year to Goal:**
• 80-90% in liquid/short-term debt
• Only 10-20% in equity

💡 **Golden Rule:** Don't sell in panic! Review fundamentals before deciding.

⚠️ **Tax Impact:** Check LTCG/STCG before redeeming. Sometimes waiting few more months saves tax!`;
    }

    // Default response with enhanced menu
    return `👋 **Hi! I'm your Mutual Fund Investment Assistant!**

I can help you with:

💰 **Calculations:**
• SIP calculations (monthly investments)
• Lump sum returns
• Step-up SIP (increasing investments)
• CAGR analysis
• Goal-based planning (retirement, education, house)
• Tax calculations (LTCG/STCG)

📚 **Investment Knowledge:**
• Fund types (Equity, Debt, Hybrid, ELSS, Index)
• Portfolio diversification strategies
• Risk assessment & selection
• Direct vs Regular plans
• NAV, AUM, Expense Ratio explained

🎯 **Practical Advice:**
• When to buy/sell funds
• How to choose best funds
• Tax-saving strategies
• Rebalancing portfolios
• Common investing mistakes

**Try asking:**
• "Calculate SIP of 5000 for 10 years at 12% return"
• "I need 50 lakhs in 15 years, how much to invest?"
• "What's the difference between direct and regular plans?"
• "Should I invest in index funds or active funds?"
• "How to build a diversified portfolio?"

💡 **Tip:** Be specific with your questions for better answers!

• NAV (Net Asset Value)
• Understanding fund types (Equity, Debt, Hybrid)
• SIP and investment strategies
• Returns, AUM, and Expense Ratio
• Risk assessment
• Tax implications
• Comparing funds

Ask me specific questions like "What is NAV?", "Explain SIP", "How are returns calculated?" etc.`;
  }
}

module.exports = AIController;
