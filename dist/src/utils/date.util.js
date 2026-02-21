/**
 * Date Utility
 * Date manipulation and formatting for financial data
 */

const moment = require('moment-timezone');

const TIMEZONE = 'Asia/Kolkata';

class DateUtil {
  /**
   * Get current IST date
   */
  static getCurrentDate() {
    return moment().tz(TIMEZONE).toDate();
  }

  /**
   * Get current IST timestamp
   */
  static getCurrentTimestamp() {
    return moment().tz(TIMEZONE);
  }

  /**
   * Format date to standard format
   */
  static formatDate(date, format = 'YYYY-MM-DD') {
    return moment(date).tz(TIMEZONE).format(format);
  }

  /**
   * Format datetime to standard format
   */
  static formatDateTime(date, format = 'YYYY-MM-DD HH:mm:ss') {
    return moment(date).tz(TIMEZONE).format(format);
  }

  /**
   * Parse date string
   */
  static parseDate(dateString, format = 'YYYY-MM-DD') {
    return moment.tz(dateString, format, TIMEZONE).toDate();
  }

  /**
   * Get date N days ago
   */
  static getDaysAgo(days) {
    return moment().tz(TIMEZONE).subtract(days, 'days').toDate();
  }

  /**
   * Get date N months ago
   */
  static getMonthsAgo(months) {
    return moment().tz(TIMEZONE).subtract(months, 'months').toDate();
  }

  /**
   * Get date N years ago
   */
  static getYearsAgo(years) {
    return moment().tz(TIMEZONE).subtract(years, 'years').toDate();
  }

  /**
   * Get start of day
   */
  static getStartOfDay(date = null) {
    const targetDate = date || this.getCurrentDate();
    return moment(targetDate).tz(TIMEZONE).startOf('day').toDate();
  }

  /**
   * Get end of day
   */
  static getEndOfDay(date = null) {
    const targetDate = date || this.getCurrentDate();
    return moment(targetDate).tz(TIMEZONE).endOf('day').toDate();
  }

  /**
   * Get start of month
   */
  static getStartOfMonth(date = null) {
    const targetDate = date || this.getCurrentDate();
    return moment(targetDate).tz(TIMEZONE).startOf('month').toDate();
  }

  /**
   * Get end of month
   */
  static getEndOfMonth(date = null) {
    const targetDate = date || this.getCurrentDate();
    return moment(targetDate).tz(TIMEZONE).endOf('month').toDate();
  }

  /**
   * Get start of year
   */
  static getStartOfYear(date = null) {
    const targetDate = date || this.getCurrentDate();
    return moment(targetDate).tz(TIMEZONE).startOf('year').toDate();
  }

  /**
   * Get end of year
   */
  static getEndOfYear(date = null) {
    const targetDate = date || this.getCurrentDate();
    return moment(targetDate).tz(TIMEZONE).endOf('year').toDate();
  }

  /**
   * Calculate date difference in days
   */
  static diffInDays(date1, date2) {
    const m1 = moment(date1);
    const m2 = moment(date2);
    return m1.diff(m2, 'days');
  }

  /**
   * Calculate date difference in months
   */
  static diffInMonths(date1, date2) {
    const m1 = moment(date1);
    const m2 = moment(date2);
    return m1.diff(m2, 'months');
  }

  /**
   * Calculate date difference in years
   */
  static diffInYears(date1, date2) {
    const m1 = moment(date1);
    const m2 = moment(date2);
    return m1.diff(m2, 'years');
  }

  /**
   * Check if date is in past
   */
  static isPast(date) {
    return moment(date).isBefore(moment());
  }

  /**
   * Check if date is in future
   */
  static isFuture(date) {
    return moment(date).isAfter(moment());
  }

  /**
   * Check if date is today
   */
  static isToday(date) {
    return moment(date).tz(TIMEZONE).isSame(moment().tz(TIMEZONE), 'day');
  }

  /**
   * Get date range for performance period
   */
  static getReturnPeriodDates(period) {
    const now = this.getCurrentDate();

    const periods = {
      '1D': { days: 1 },
      '1W': { days: 7 },
      '1M': { months: 1 },
      '3M': { months: 3 },
      '6M': { months: 6 },
      '1Y': { years: 1 },
      '3Y': { years: 3 },
      '5Y': { years: 5 },
      '10Y': { years: 10 },
    };

    const config = periods[period];
    if (!config) {
      throw new Error(`Invalid period: ${period}`);
    }

    let startDate;
    if (config.days) {
      startDate = this.getDaysAgo(config.days);
    } else if (config.months) {
      startDate = this.getMonthsAgo(config.months);
    } else if (config.years) {
      startDate = this.getYearsAgo(config.years);
    }

    return {
      startDate,
      endDate: now,
    };
  }

  /**
   * Get financial year dates
   */
  static getFinancialYear(year = null) {
    const targetYear = year || moment().tz(TIMEZONE).year();

    // Indian financial year: April 1 to March 31
    const startDate = moment.tz([targetYear, 3, 1], TIMEZONE).toDate(); // April 1
    const endDate = moment.tz([targetYear + 1, 2, 31], TIMEZONE).toDate(); // March 31

    return {
      startDate,
      endDate,
      fyLabel: `FY ${targetYear}-${(targetYear + 1).toString().slice(2)}`,
    };
  }

  /**
   * Get current financial year
   */
  static getCurrentFinancialYear() {
    const now = moment().tz(TIMEZONE);
    const year = now.year();
    const month = now.month(); // 0-indexed

    // If before April (month 3), FY is previous year
    const fyYear = month < 3 ? year - 1 : year;

    return this.getFinancialYear(fyYear);
  }

  /**
   * Get quarter dates
   */
  static getQuarter(year, quarter) {
    const quarterMonths = {
      1: { start: 0, end: 2 }, // Jan-Mar
      2: { start: 3, end: 5 }, // Apr-Jun
      3: { start: 6, end: 8 }, // Jul-Sep
      4: { start: 9, end: 11 }, // Oct-Dec
    };

    const months = quarterMonths[quarter];
    if (!months) {
      throw new Error('Invalid quarter. Must be 1, 2, 3, or 4');
    }

    const startDate = moment
      .tz([year, months.start, 1], TIMEZONE)
      .startOf('month')
      .toDate();
    const endDate = moment
      .tz([year, months.end, 1], TIMEZONE)
      .endOf('month')
      .toDate();

    return {
      startDate,
      endDate,
      quarter,
      year,
      label: `Q${quarter} ${year}`,
    };
  }

  /**
   * Get current quarter
   */
  static getCurrentQuarter() {
    const now = moment().tz(TIMEZONE);
    const quarter = Math.ceil((now.month() + 1) / 3);
    return this.getQuarter(now.year(), quarter);
  }

  /**
   * Convert DD-MMM-YYYY to Date (AMFI format)
   */
  static parseAMFIDate(dateString) {
    // Example: "01-Jan-2024"
    return moment(dateString, 'DD-MMM-YYYY').tz(TIMEZONE).toDate();
  }

  /**
   * Format date for AMFI
   */
  static formatAMFIDate(date) {
    return moment(date).tz(TIMEZONE).format('DD-MMM-YYYY');
  }

  /**
   * Get relative time string
   */
  static getRelativeTime(date) {
    return moment(date).tz(TIMEZONE).fromNow();
  }

  /**
   * Add business days
   */
  static addBusinessDays(date, days) {
    let current = moment(date).tz(TIMEZONE);
    let remaining = days;

    while (remaining > 0) {
      current.add(1, 'day');
      // Skip weekends
      if (current.day() !== 0 && current.day() !== 6) {
        remaining--;
      }
    }

    return current.toDate();
  }

  /**
   * Check if two dates are same day
   */
  static isSameDay(date1, date2) {
    return moment(date1).tz(TIMEZONE).isSame(moment(date2).tz(TIMEZONE), 'day');
  }

  /**
   * Get age in years from date
   */
  static getAgeInYears(birthDate) {
    return moment().tz(TIMEZONE).diff(moment(birthDate), 'years');
  }
}

module.exports = DateUtil;
