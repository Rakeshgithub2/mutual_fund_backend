/**
 * Simple translation service
 * In production, use Google Translate API or similar service
 */

// Translation dictionaries
const translations = {
  hindi: {
    // Common financial terms
    'stock market': 'शेयर बाजार',
    'mutual fund': 'म्यूचुअल फंड',
    investment: 'निवेश',
    stocks: 'शेयर',
    market: 'बाजार',
    economy: 'अर्थव्यवस्था',
    trading: 'व्यापार',
    portfolio: 'पोर्टफोलियो',
    dividend: 'लाभांश',
    returns: 'रिटर्न',
    growth: 'वृद्धि',
    profit: 'लाभ',
    loss: 'हानि',
    equity: 'इक्विटी',
    debt: 'डेट',
    gold: 'सोना',
    silver: 'चांदी',
    commodities: 'कमोडिटी',
  },
  kannada: {
    // Common financial terms in Kannada
    'stock market': 'ಷೇರು ಮಾರುಕಟ್ಟೆ',
    'mutual fund': 'ಮ್ಯೂಚುಯಲ್ ಫಂಡ್',
    investment: 'ಹೂಡಿಕೆ',
    stocks: 'ಷೇರುಗಳು',
    market: 'ಮಾರುಕಟ್ಟೆ',
    economy: 'ಆರ್ಥಿಕತೆ',
    trading: 'ವ್ಯಾಪಾರ',
    portfolio: 'ಪೋರ್ಟ್ಫೋಲಿಯೋ',
    dividend: 'ಡಿವಿಡೆಂಡ್',
    returns: 'ಲಾಭ',
    growth: 'ಬೆಳವಣಿಗೆ',
    profit: 'ಲಾಭ',
    loss: 'ನಷ್ಟ',
    equity: 'ಇಕ್ವಿಟಿ',
    debt: 'ಸಾಲ',
    gold: 'ಚಿನ್ನ',
    silver: 'ಬೆಳ್ಳಿ',
    commodities: 'ಸರಕುಗಳು',
  },
};

/**
 * Translate text to target language
 * This is a simple implementation - in production use proper translation API
 */
const translate = async (text, targetLanguage) => {
  if (!text || targetLanguage === 'english') {
    return text;
  }

  try {
    // Simple word replacement (for demo purposes)
    let translatedText = text.toLowerCase();

    if (translations[targetLanguage]) {
      Object.keys(translations[targetLanguage]).forEach((key) => {
        const regex = new RegExp(key, 'gi');
        translatedText = translatedText.replace(
          regex,
          translations[targetLanguage][key]
        );
      });
    }

    return translatedText;
  } catch (error) {
    console.error('Translation error:', error);
    return text; // Return original text if translation fails
  }
};

/**
 * Batch translate multiple texts
 */
const batchTranslate = async (texts, targetLanguage) => {
  const promises = texts.map((text) => translate(text, targetLanguage));
  return Promise.all(promises);
};

module.exports = {
  translate,
  batchTranslate,
};
