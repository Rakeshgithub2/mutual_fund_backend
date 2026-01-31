import { Document, Collection } from 'mongodb';

export interface SectorAllocation {
  schemeCode: string;
  sectors: Array<{
    sector: string;
    percentage: number;
  }>;
}

export function getSectorAllocationCollection(
  db: any
): Collection<SectorAllocation> {
  return db.collection<SectorAllocation>('sectorAllocation');
}
