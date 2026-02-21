"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getHoldingsCollection = getHoldingsCollection;
function getHoldingsCollection(db) {
    return db.collection('holdings');
}
