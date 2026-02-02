import { Document, Collection, Db } from 'mongodb';

export interface Holding {
  schemeCode: string;
  holdings: Array<{
    company: string;
    sector: string;
    percentage: number;
  }>;
  fetchedAt: Date;
}

export function getHoldingsCollection(db: Db): Collection<Holding> {
  return db.collection<Holding>('holdings');
}
