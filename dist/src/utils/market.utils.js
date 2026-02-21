/**
 * Market Utility Functions
 * Holiday detection, trading hours, business day calculations
 */

const axios = require('axios');

// NSE/BSE Holiday Calendar 2024-2025
const MARKET_HOLIDAYS_2024 = [
  '2024-01-26', // Republic Day
  '2024-03-08', // Mahashivratri
  '2024-03-25', // Holi
  '2024-03-29', // Good Friday
  '2024-04-11', // Id-Ul-Fitr
  '2024-04-17', // Ram Navami
  '2024-04-21', // Mahavir Jayanti
  '2024-05-01', // Maharashtra Day
  '2024-05-20', // Election Day
  '2024-06-17', // Bakri Id
  '2024-07-17', // Muharram
  '2024-08-15', // Independence Day
  '2024-09-16', // Eid-e-Milad
  '2024-10-02', // Gandhi Jayanti
  '2024-11-01', // Diwali Laxmi Pujan
  '2024-11-15', // Gurunanak Jayanti
  '2024-12-25', // Christmas
];

const MARKET_HOLIDAYS_2025 = [
  '2025-01-26', // Republic Day
  '2025-02-26', // Mahashivratri
  '2025-03-14', // Holi
  '2025-03-31', // Id-Ul-Fitr
  '2025-04-10', // Mahavir Jayanti
  '2025-04-14', // Ambedkar Jayanti
  '2025-04-18', // Good Friday
  '2025-05-01', // Maharashtra Day
  '2025-06-06', // Bakri Id
  '2025-07-06', // Muharram
  '2025-08-15', // Independence Day
  '2025-08-27', // Janmashtami
  '2025-09-05', // Eid-e-Milad
  '2025-10-02', // Gandhi Jayanti
  '2025-10-21', // Diwali Laxmi Pujan
  '2025-11-05', // Gurunanak Jayanti
  '2025-12-25', // Christmas
];

const ALL_HOLIDAYS = [...MARKET_HOLIDAYS_2024, ...MARKET_HOLIDAYS_2025];

/**
 * Check if a given date is a market holiday
 */
function isMarketHoliday(date) {
  const dateStr = formatDate(date);

  // Check weekends
  const dayOfWeek = date.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return true; // Sunday or Saturday
  }

  // Check holiday calendar
  return ALL_HOLIDAYS.includes(dateStr);
}

/**
 * Check if current time is within trading hours
 * Trading hours: 9:15 AM - 3:30 PM IST (Mon-Fri)
 */
function isTradingHours(date = new Date()) {
  // Convert to IST
  const istDate = new Date(
    date.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })
  );

  const hours = istDate.getHours();
  const minutes = istDate.getMinutes();

  // Check if weekend
  const dayOfWeek = istDate.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return false;
  }

  // Check if holiday
  if (isMarketHoliday(istDate)) {
    return false;
  }

  // Trading hours: 9:15 AM to 3:30 PM
  const startTime = 9 * 60 + 15; // 9:15 AM in minutes
  const endTime = 15 * 60 + 30; // 3:30 PM in minutes
  const currentTime = hours * 60 + minutes;

  return currentTime >= startTime && currentTime <= endTime;
}

/**
 * Get the last trading day before a given date
 */
function getLastTradingDay(date = new Date()) {
  let checkDate = new Date(date);
  checkDate.setDate(checkDate.getDate() - 1);

  // Keep going back until we find a trading day
  while (isMarketHoliday(checkDate)) {
    checkDate.setDate(checkDate.getDate() - 1);

    // Safety limit: don't go back more than 30 days
    if (Math.abs(date - checkDate) > 30 * 24 * 60 * 60 * 1000) {
      break;
    }
  }

  return checkDate;
}

/**
 * Get the next trading day after a given date
 */
function getNextTradingDay(date = new Date()) {
  let checkDate = new Date(date);
  checkDate.setDate(checkDate.getDate() + 1);

  // Keep going forward until we find a trading day
  while (isMarketHoliday(checkDate)) {
    checkDate.setDate(checkDate.getDate() + 1);

    // Safety limit: don't go forward more than 30 days
    if (Math.abs(checkDate - date) > 30 * 24 * 60 * 60 * 1000) {
      break;
    }
  }

  return checkDate;
}

/**
 * Get number of trading days between two dates
 */
function getTradingDaysBetween(startDate, endDate) {
  let count = 0;
  let currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    if (!isMarketHoliday(currentDate)) {
      count++;
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return count;
}

/**
 * Check if market is currently open (live check)
 */
async function isMarketOpenNow() {
  const now = new Date();

  // Quick local check first
  if (!isTradingHours(now)) {
    return false;
  }

  // Optional: Verify with NSE API (can be rate-limited)
  try {
    const response = await axios.get(
      'https://www.nseindia.com/api/marketStatus',
      {
        timeout: 5000,
        headers: {
          'User-Agent': 'Mozilla/5.0',
          Accept: 'application/json',
        },
      }
    );

    const marketStatus = response.data?.marketState?.toLowerCase();
    return marketStatus === 'open';
  } catch (error) {
    // Fall back to local check if API fails
    console.warn('Market status API check failed, using local logic');
    return isTradingHours(now);
  }
}

/**
 * Format date to YYYY-MM-DD
 */
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get market session info
 */
function getMarketSession(date = new Date()) {
  const istDate = new Date(
    date.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })
  );
  const hours = istDate.getHours();
  const minutes = istDate.getMinutes();

  if (!isTradingHours(istDate)) {
    return {
      session: 'CLOSED',
      message: 'Market is closed',
      nextOpen: getNextTradingDay(istDate),
    };
  }

  const currentTime = hours * 60 + minutes;

  // Pre-open: 9:00 AM - 9:15 AM
  if (currentTime >= 9 * 60 && currentTime < 9 * 60 + 15) {
    return { session: 'PRE_OPEN', message: 'Pre-open session' };
  }

  // Normal trading: 9:15 AM - 3:30 PM
  if (currentTime >= 9 * 60 + 15 && currentTime <= 15 * 60 + 30) {
    return { session: 'OPEN', message: 'Market is open' };
  }

  // Post-close
  return {
    session: 'CLOSED',
    message: 'Market is closed',
    nextOpen: getNextTradingDay(istDate),
  };
}

/**
 * Fetch live holidays from NSE (optional)
 */
async function fetchLiveHolidays() {
  try {
    const response = await axios.get(
      'https://www.nseindia.com/api/holiday-master?type=trading',
      {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0',
          Accept: 'application/json',
        },
      }
    );

    const holidays = response.data?.CM || [];
    return holidays.map((h) => h.tradingDate);
  } catch (error) {
    console.warn('Failed to fetch live holidays, using local calendar');
    return ALL_HOLIDAYS;
  }
}

module.exports = {
  isMarketHoliday,
  isTradingHours,
  getLastTradingDay,
  getNextTradingDay,
  getTradingDaysBetween,
  isMarketOpenNow,
  getMarketSession,
  fetchLiveHolidays,
  formatDate,
  MARKET_HOLIDAYS_2024,
  MARKET_HOLIDAYS_2025,
  ALL_HOLIDAYS,
};
