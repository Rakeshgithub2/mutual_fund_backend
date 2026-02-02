import { Document, Collection, Db } from 'mongodb';

export interface SectorAllocation {
  schemeCode: string;
  sectors: Array<{
    sector: string;
    percentage: number;
  }>;
}

export function getSectorAllocationCollection(
  db: Db
): Collection<SectorAllocation> {
  return db.collection<SectorAllocation>('sectorAllocation');
}
