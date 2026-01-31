/**
 * MongoDB Atlas Configuration
 * Production-ready database connection with retry logic and monitoring
 */

const mongoose = require('mongoose');

const MONGODB_URI =
  process.env.DATABASE_URL ||
  process.env.MONGODB_URI ||
  'mongodb://localhost:27017/mutual-funds';
const DB_OPTIONS = {
  maxPoolSize: 50,
  minPoolSize: 10,
  socketTimeoutMS: 45000,
  serverSelectionTimeoutMS: 5000,
  retryWrites: true,
  retryReads: true,
};

class DatabaseConfig {
  constructor() {
    this.isConnected = false;
    this.retryCount = 0;
    this.maxRetries = 5;
  }

  /**
   * Connect to MongoDB Atlas with retry logic
   */
  async connect() {
    if (this.isConnected) {
      console.log('📊 MongoDB: Already connected');
      return;
    }

    try {
      await mongoose.connect(MONGODB_URI, DB_OPTIONS);
      this.isConnected = true;
      this.retryCount = 0;

      console.log('✅ MongoDB Atlas connected successfully');
      console.log(`📍 Database: ${mongoose.connection.name}`);

      this.setupEventListeners();
    } catch (error) {
      console.error('❌ MongoDB connection error:', error.message);

      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        console.log(
          `⏳ Retrying connection (${this.retryCount}/${this.maxRetries})...`
        );
        setTimeout(() => this.connect(), 5000 * this.retryCount);
      } else {
        console.error('💥 Max retry attempts reached. Exiting...');
        process.exit(1);
      }
    }
  }

  /**
   * Setup MongoDB event listeners for monitoring
   */
  setupEventListeners() {
    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ MongoDB disconnected');
      this.isConnected = false;

      // Attempt to reconnect
      if (this.retryCount < this.maxRetries) {
        this.connect();
      }
    });

    mongoose.connection.on('error', (error) => {
      console.error('❌ MongoDB error:', error.message);
    });

    mongoose.connection.on('reconnected', () => {
      console.log('🔄 MongoDB reconnected');
      this.isConnected = true;
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      await this.disconnect();
      process.exit(0);
    });
  }

  /**
   * Disconnect from MongoDB
   */
  async disconnect() {
    if (!this.isConnected) return;

    try {
      await mongoose.connection.close();
      this.isConnected = false;
      console.log('🔌 MongoDB connection closed');
    } catch (error) {
      console.error('❌ Error closing MongoDB connection:', error.message);
    }
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      readyState: mongoose.connection.readyState,
      host: mongoose.connection.host,
      database: mongoose.connection.name,
    };
  }

  /**
   * Create indexes for all collections
   * Called during app initialization
   */
  async createIndexes() {
    try {
      console.log('📊 Creating database indexes...');

      // Import all models to ensure they're registered
      require('../models/User.model');
      require('../models/Fund.model');
      require('../models/FundNav.model');
      require('../models/FundHolding.model');
      require('../models/MarketIndex.model');
      require('../models/Watchlist.model');
      require('../models/Goal.model');
      require('../models/Reminder.model');

      // Sync indexes for all models
      await Promise.all(
        Object.values(mongoose.connection.models).map((model) =>
          model.syncIndexes().catch((err) => {
            console.warn(
              `⚠️ Could not sync indexes for ${model.modelName}: ${err.message}`
            );
          })
        )
      );

      console.log('✅ Database indexes synchronized');
    } catch (error) {
      console.warn(`⚠️ Error creating indexes: ${error.message}`);
      // Don't fail the app if index creation fails
    }
  }
}

// Singleton instance
const dbConfig = new DatabaseConfig();

module.exports = dbConfig;
