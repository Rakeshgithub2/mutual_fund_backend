"use strict";
/**
 * MongoDB Indexes Setup for Free-Tier Optimization
 * Run this script once to create necessary indexes
 * Prevents memory errors and improves query performance
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createIndexes = createIndexes;
const mongodb_1 = require("../db/mongodb");
async function createIndexes() {
    try {
        console.log('🔧 Creating MongoDB indexes for optimal performance...\n');
        await mongodb_1.mongodb.connect();
        const collection = mongodb_1.mongodb.getCollection('funds');
        // 1. Index on isActive for filtering (most queries use this)
        console.log('Creating index on isActive...');
        await collection.createIndex({ isActive: 1 });
        console.log('✅ Index created: isActive');
        // 2. Compound index for isActive + _id (default sort)
        console.log('Creating compound index: isActive + _id...');
        await collection.createIndex({ isActive: 1, _id: -1 });
        console.log('✅ Index created: isActive + _id');
        // 3. Index on category for category filtering
        console.log('Creating index on category...');
        await collection.createIndex({ category: 1 });
        console.log('✅ Index created: category');
        // 4. Index on subCategory for subcategory filtering
        console.log('Creating index on subCategory...');
        await collection.createIndex({ subCategory: 1 });
        console.log('✅ Index created: subCategory');
        // 5. Compound index for category queries
        console.log('Creating compound index: isActive + category...');
        await collection.createIndex({ isActive: 1, category: 1 });
        console.log('✅ Index created: isActive + category');
        // 6. Compound index for subcategory queries
        console.log('Creating compound index: isActive + subCategory...');
        await collection.createIndex({ isActive: 1, subCategory: 1 });
        console.log('✅ Index created: isActive + subCategory');
        // 7. Text index for search functionality
        console.log('Creating text index on name...');
        await collection.createIndex({ name: 'text' });
        console.log('✅ Index created: text on name');
        // 8. Index on fundId for lookups
        console.log('Creating index on fundId...');
        await collection.createIndex({ fundId: 1 }, { unique: true });
        console.log('✅ Index created: fundId (unique)');
        // List all indexes
        console.log('\n📋 All indexes:');
        const indexes = await collection.indexes();
        indexes.forEach((index, i) => {
            console.log(`${i + 1}. ${index.name}:`, JSON.stringify(index.key));
        });
        console.log('\n✅ All indexes created successfully!');
        console.log('🎯 MongoDB queries will now be memory-safe and fast');
        process.exit(0);
    }
    catch (error) {
        console.error('❌ Error creating indexes:', error);
        process.exit(1);
    }
}
// Run if executed directly
if (require.main === module) {
    createIndexes();
}
