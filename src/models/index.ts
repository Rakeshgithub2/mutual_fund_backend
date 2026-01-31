/**
 * Models Index
 * Central export point for all MongoDB models
 *
 * IMPORTANT: Ensure database is connected before using models!
 * Models use singleton pattern with getInstance() method.
 *
 * Usage:
 *   import { FundModel } from './models';
 *   const fundModel = FundModel.getInstance();
 */

export { FundModel, FundSchema, type FundInput } from './Fund.model';
export {
  FundPriceModel,
  FundPriceSchema,
  type FundPriceInput,
} from './FundPrice.model';
export {
  FundManagerModel,
  FundManagerSchema,
  type FundManagerInput,
} from './FundManager.model';
export { UserModel, UserSchema, type UserInput } from './User.model';
export {
  WatchlistModel,
  WatchlistSchema,
  type WatchlistInput,
} from './Watchlist.model';
export {
  PortfolioModel,
  PortfolioSchema,
  type PortfolioInput,
} from './Portfolio.model';
export { GoalModel, GoalSchema, type GoalInput } from './Goal.model';

// Re-export schemas from db/schemas for convenience
export * from '../db/schemas';
