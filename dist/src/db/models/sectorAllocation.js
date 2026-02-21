"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSectorAllocationCollection = getSectorAllocationCollection;
function getSectorAllocationCollection(db) {
    return db.collection('sectorAllocation');
}
