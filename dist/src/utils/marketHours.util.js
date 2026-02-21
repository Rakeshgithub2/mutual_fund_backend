/**
 * Market Hours Utility
 * Determine if Indian stock market is open
 */

const moment = require('moment-timezone');

const TIMEZONE = 'Asia/Kolkata';

// Indian stock market hours
const MARKET_HOURS = {
  PRE_OPEN_START: { hour: 9, minute: 0 },
  PRE_OPEN_END: { hour: 9, minute: 15 },
  MARKET_OPEN: { hour: 9, minute: 15 },
  MARKET_CLOSE: { hour: 15, minute: 30 },
};

// Market holidays (sample - should be updated annually)
const MARKET_HOLIDAYS_2024 = [
  '2024-01-26', // Republic Day
  '2024-03-08', // Maha Shivaratri
  '2024-03-25', // Holi
  '2024-03-29', // Good Friday
  '2024-04-11', // Id-Ul-Fitr
  '2024-04-17', // Ram Navami
  '2024-04-21', // Mahavir Jayanti
  '2024-05-01', // Maharashtra Day
  '2024-05-23', // Buddha Purnima
  '2024-06-17', // Bakri Id
  '2024-07-17', // Muharram
  '2024-08-15', // Independence Day
  '2024-08-26', // Janmashtami
  '2024-09-16', // Eid-e-Milad
  '2024-10-02', // Gandhi Jayanti
  '2024-10-12', // Dussehra
  '2024-11-01', // Diwali
  '2024-11-15', // Gurunanak Jayanti
  '2024-12-25', // Christmas
];

const MARKET_HOLIDAYS_2025 = [
  '2025-01-26', // Republic Day
  '2025-02-26', // Maha Shivaratri
  '2025-03-14', // Holi
  '2025-03-31', // Id-Ul-Fitr
  '2025-04-06', // Ram Navami
  '2025-04-10', // Mahavir Jayanti
  '2025-04-18', // Good Friday
  '2025-05-01', // Maharashtra Day
  '2025-05-12', // Buddha Purnima
  '2025-06-07', // Bakri Id
  '2025-08-15', // Independence Day
  '2025-08-27', // Janmashtami
  '2025-09-05', // Eid-e-Milad
  '2025-10-02', // Gandhi Jayanti
  '2025-10-03', // Dussehra
  '2025-10-21', // Diwali
  '2025-11-05', // Gurunanak Jayanti
  '2025-12-25', // Christmas
];

class MarketHoursUtil {
  /**
   * Get current IST time
   */
  static getCurrentIST() {
    return moment().tz(TIMEZONE);
  }

  /**
   * Check if market is currently open
   */
  static isMarketOpen() {
    const now = this.getCurrentIST();

    // Check if it's a weekend
    const dayOfWeek = now.day();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return false; // Closed on Saturday & Sunday
    }

    // Check if it's a holiday
    if (this.isMarketHoliday(now)) {
      return false;
    }

    // Check market hours
    const currentHour = now.hour();
    const currentMinute = now.minute();
    const currentTimeInMinutes = currentHour * 60 + currentMinute;

    const marketOpenTime =
      MARKET_HOURS.MARKET_OPEN.hour * 60 + MARKET_HOURS.MARKET_OPEN.minute;
    const marketCloseTime =
      MARKET_HOURS.MARKET_CLOSE.hour * 60 + MARKET_HOURS.MARKET_CLOSE.minute;

    return (
      currentTimeInMinutes >= marketOpenTime &&
      currentTimeInMinutes <= marketCloseTime
    );
  }

  /**
   * Check if currently in pre-open session
   */
  static isPreOpen() {
    const now = this.getCurrentIST();

    // Check if it's a weekend or holiday
    if (now.day() === 0 || now.day() === 6 || this.isMarketHoliday(now)) {
      return false;
    }

    const currentHour = now.hour();
    const currentMinute = now.minute();
    const currentTimeInMinutes = currentHour * 60 + currentMinute;

    const preOpenStart =
      MARKET_HOURS.PRE_OPEN_START.hour * 60 +
      MARKET_HOURS.PRE_OPEN_START.minute;
    const preOpenEnd =
      MARKET_HOURS.PRE_OPEN_END.hour * 60 + MARKET_HOURS.PRE_OPEN_END.minute;

    return (
      currentTimeInMinutes >= preOpenStart && currentTimeInMinutes < preOpenEnd
    );
  }

  /**
   * Check if given date is a market holiday
   */
  static isMarketHoliday(date = null) {
    const checkDate = date ? moment(date).tz(TIMEZONE) : this.getCurrentIST();
    const dateString = checkDate.format('YYYY-MM-DD');

    // Combine all holidays
    const allHolidays = [...MARKET_HOLIDAYS_2024, ...MARKET_HOLIDAYS_2025];

    return allHolidays.includes(dateString);
  }

  /**
   * Check if given date is a trading day
   */
  static isTradingDay(date = null) {
    const checkDate = date ? moment(date).tz(TIMEZONE) : this.getCurrentIST();
    const dayOfWeek = checkDate.day();

    // Not a trading day if weekend or holiday
    return (
      dayOfWeek !== 0 && dayOfWeek !== 6 && !this.isMarketHoliday(checkDate)
    );
  }

  /**
   * Get market status
   */
  static getMarketStatus() {
    if (this.isPreOpen()) {
      return 'PRE_OPEN';
    } else if (this.isMarketOpen()) {
      return 'OPEN';
    } else if (this.isMarketHoliday()) {
      return 'HOLIDAY';
    } else {
      return 'CLOSED';
    }
  }

  /**
   * Get next trading day
   */
  static getNextTradingDay(date = null) {
    let checkDate = date ? moment(date).tz(TIMEZONE) : this.getCurrentIST();
    checkDate = checkDate.clone().add(1, 'day');

    // Find next trading day (max 30 days ahead)
    let attempts = 0;
    while (!this.isTradingDay(checkDate) && attempts < 30) {
      checkDate.add(1, 'day');
      attempts++;
    }

    return checkDate;
  }

  /**
   * Get previous trading day
   */
  static getPreviousTradingDay(date = null) {
    let checkDate = date ? moment(date).tz(TIMEZONE) : this.getCurrentIST();
    checkDate = checkDate.clone().subtract(1, 'day');

    // Find previous trading day (max 30 days back)
    let attempts = 0;
    while (!this.isTradingDay(checkDate) && attempts < 30) {
      checkDate.subtract(1, 'day');
      attempts++;
    }

    return checkDate;
  }

  /**
   * Get time until market opens
   */
  static getTimeUntilMarketOpen() {
    const now = this.getCurrentIST();

    if (this.isMarketOpen()) {
      return 0;
    }

    let nextOpen = now.clone();

    // If after market close today, move to next day
    const currentTimeInMinutes = now.hour() * 60 + now.minute();
    const marketCloseTime =
      MARKET_HOURS.MARKET_CLOSE.hour * 60 + MARKET_HOURS.MARKET_CLOSE.minute;

    if (currentTimeInMinutes > marketCloseTime) {
      nextOpen.add(1, 'day');
    }

    // Find next trading day
    while (!this.isTradingDay(nextOpen)) {
      nextOpen.add(1, 'day');
    }

    // Set to market open time
    nextOpen.hour(MARKET_HOURS.MARKET_OPEN.hour);
    nextOpen.minute(MARKET_HOURS.MARKET_OPEN.minute);
    nextOpen.second(0);

    return nextOpen.diff(now, 'milliseconds');
  }

  /**
   * Get time until market closes
   */
  static getTimeUntilMarketClose() {
    const now = this.getCurrentIST();

    if (!this.isMarketOpen()) {
      return 0;
    }

    const marketClose = now.clone();
    marketClose.hour(MARKET_HOURS.MARKET_CLOSE.hour);
    marketClose.minute(MARKET_HOURS.MARKET_CLOSE.minute);
    marketClose.second(0);

    return marketClose.diff(now, 'milliseconds');
  }

  /**
   * Should update market indices?
   */
  static shouldUpdateIndices() {
    return this.isMarketOpen();
  }

  /**
   * Get market session info
   */
  static getMarketSessionInfo() {
    const status = this.getMarketStatus();
    const now = this.getCurrentIST();

    return {
      status,
      isOpen: status === 'OPEN',
      isPreOpen: status === 'PRE_OPEN',
      isClosed: status === 'CLOSED' || status === 'HOLIDAY',
      isHoliday: status === 'HOLIDAY',
      currentTime: now.format('YYYY-MM-DD HH:mm:ss'),
      timezone: TIMEZONE,
      nextTradingDay: this.getNextTradingDay().format('YYYY-MM-DD'),
      timeUntilOpen: status !== 'OPEN' ? this.getTimeUntilMarketOpen() : 0,
      timeUntilClose: status === 'OPEN' ? this.getTimeUntilMarketClose() : 0,
    };
  }

  /**
   * Format time remaining
   */
  static formatTimeRemaining(milliseconds) {
    const duration = moment.duration(milliseconds);
    const hours = Math.floor(duration.asHours());
    const minutes = duration.minutes();

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days} day${days > 1 ? 's' : ''}`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }
}

module.exports = MarketHoursUtil;
