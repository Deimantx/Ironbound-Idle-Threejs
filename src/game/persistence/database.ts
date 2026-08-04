import Dexie, { type Table } from 'dexie';
import type { SaveRecord } from './saveManager';

class IronboundDatabase extends Dexie {
  saves!: Table<SaveRecord, number>;
  constructor() {
    super('ironbound-idle');
    this.version(1).stores({ saves: 'slot,profileId,updatedAt' });
  }
}
export const database = new IronboundDatabase();
