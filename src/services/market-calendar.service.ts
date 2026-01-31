/**
 * Market Calendar Service
 * Manages NSE/BSE trading days, holidays, and market hours
 */

import mongoose from 'mongoose';
import moment from 'moment-timezone';

// Market Calendar Schema
const marketCalendarSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true, unique: true },
    isHoliday: { type: Boolean, default: false },
    holidayName: String,
    exchange: { type: String, enum: ['NSE', 'BSE', 'BOTH'], default: 'BOTH' },
    marketOpen: { type: String, default: '09:15' }, // IST
    marketClose: { type: String, default: '15:30' }, // IST
    specialNote: String,
    updatedAt: { type: Date, default: Date.now },
  },
  {
    collection: 'market_calendar',
  }
);

marketCalendarSchema.index({ date: 1 });

const MarketCalendar = mongoose.model('MarketCalendar', marketCalendarSchema);

export class MarketCalendarService {
  /**
   * Check if market is open at current time
   */
  static async isMarketOpen(): Promise<{ isOpen: boolean; reason?: string }> {
    const now = moment().tz('Asia/Kolkata');
    const currentDate = now.format('YYYY-MM-DD');
    const currentTime = now.format('HH:mm');
    const dayOfWeek = now.day(); // 0 = Sunday, 6 = Saturday

    // Check if weekend
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return { isOpen: false, reason: 'Weekend' };
    }

    // Check if holiday
    const calendar = await MarketCalendar.findOne({
      date: new Date(currentDate),
    });

    if (calendar?.isHoliday) {
      return {
        isOpen: false,
        reason: calendar.holidayName || 'Market Holiday',
      };
    }

    // Check market hours (default: 09:15 - 15:30 IST)
    const marketOpen = calendar?.marketOpen || '09:15';
    const marketClose = calendar?.marketClose || '15:30';

    if (currentTime < marketOpen) {
      return { isOpen: false, reason: 'Market not yet opened' };
    }

    if (currentTime > marketClose) {
      return { isOpen: false, reason: 'Market closed for the day' };
    }

    return { isOpen: true };
  }

  /**
   * Get market status with detailed info
   */
  static async getMarketStatus() {
    const now = moment().tz('Asia/Kolkata');
    const { isOpen, reason } = await this.isMarketOpen();

    return {
      isOpen,
      reason,
      currentTime: now.format('DD MMM YYYY, hh:mm A'),
      timestamp: now.toISOString(),
    };
  }

  /**
   * Add holidays to calendar (batch operation)
   */
  static async addHolidays(
    holidays: Array<{
      date: string;
      name: string;
      exchange?: 'NSE' | 'BSE' | 'BOTH';
    }>
  ) {
    const operations = holidays.map((holiday) => ({
      updateOne: {
        filter: { date: new Date(holiday.date) },
        update: {
          $set: {
            isHoliday: true,
            holidayName: holiday.name,
            exchange: holiday.exchange || 'BOTH',
            updatedAt: new Date(),
          },
        },
        upsert: true,
      },
    }));

    return await MarketCalendar.bulkWrite(operations);
  }

  /**
   * Seed 2026 Indian Market Holidays (NSE/BSE)
   */
  static async seed2026Holidays() {
    const holidays2026 = [
      { date: '2026-01-26', name: 'Republic Day' },
      { date: '2026-03-03', name: 'Mahashivratri' },
      { date: '2026-03-11', name: 'Holi' },
      { date: '2026-03-30', name: 'Ram Navami' },
      { date: '2026-04-02', name: 'Mahavir Jayanti' },
      { date: '2026-04-03', name: 'Good Friday' },
      { date: '2026-04-06', name: 'Id-Ul-Fitr (Ramadan Eid)' },
      { date: '2026-04-14', name: 'Dr. Baba Saheb Ambedkar Jayanti' },
      { date: '2026-05-01', name: 'Maharashtra Day' },
      { date: '2026-06-15', name: 'Id-Ul-Adha (Bakri Eid)' },
      { date: '2026-07-06', name: 'Muharram' },
      { date: '2026-08-15', name: 'Independence Day' },
      { date: '2026-08-27', name: 'Janmashtami' },
      { date: '2026-09-05', name: 'Ganesh Chaturthi' },
      { date: '2026-10-02', name: 'Gandhi Jayanti' },
      { date: '2026-10-20', name: 'Dussehra' },
      { date: '2026-10-24', name: 'Milad-Un-Nabi' },
      { date: '2026-11-09', name: 'Diwali' },
      { date: '2026-11-10', name: 'Diwali (Balipratipada)' },
      { date: '2026-11-24', name: 'Gurunanak Jayanti' },
      { date: '2026-12-25', name: 'Christmas' },
    ];

    return await this.addHolidays(holidays2026);
  }

  /**
   * Check if a specific date is a trading day
   */
  static async isTradingDay(date: Date): Promise<boolean> {
    const dayOfWeek = moment(date).day();

    // Weekend check
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return false;
    }

    // Holiday check
    const calendar = await MarketCalendar.findOne({ date });
    return !calendar?.isHoliday;
  }

  /**
   * Get next trading day
   */
  static async getNextTradingDay(fromDate: Date = new Date()): Promise<Date> {
    let nextDay = moment(fromDate).add(1, 'day');

    while (!(await this.isTradingDay(nextDay.toDate()))) {
      nextDay.add(1, 'day');
    }

    return nextDay.toDate();
  }
}

export default MarketCalendarService;
