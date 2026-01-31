import { Document, Collection } from 'mongodb';

export interface Holding {
  schemeCode: string;
  holdings: Array<{
    company: string;
    sector: string;
    percentage: number;
  }>;
  fetchedAt: Date;
}

export function getHoldingsCollection(db: any): Collection<Holding> {
  return db.collection<Holding>('holdings');
}
