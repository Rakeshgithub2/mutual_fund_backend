"""
Sector Classification
Automatically classify securities into sectors based on company names
"""

import json
import os
from pymongo import MongoClient
from dotenv import load_dotenv
import re

load_dotenv()

MONGODB_URI = os.getenv('MONGODB_URI', 'mongodb://localhost:27017/mutual-funds')
SECTOR_MAPPING_FILE = 'sector_mapping.json'

def load_sector_mapping():
    """Load sector mapping configuration"""
    with open(SECTOR_MAPPING_FILE, 'r') as f:
        return json.load(f)

def classify_security(security_name, sector_mapping):
    """Classify a security into a sector"""
    
    # Direct match with company names
    for sector, companies in sector_mapping['sectorMapping'].items():
        for company in companies:
            if company.lower() in security_name.lower():
                return sector
    
    # Fallback pattern matching
    for rule in sector_mapping['fallbackRules']:
        if re.search(rule['pattern'], security_name, re.IGNORECASE):
            return rule['sector']
    
    # Default
    return 'Others'

def classify_all_holdings():
    """Classify all holdings in database"""
    
    print("🔄 Classifying securities into sectors...")
    
    # Connect to MongoDB
    client = MongoClient(MONGODB_URI)
    db = client.get_database()
    holdings = db['fund_holdings']
    
    # Load sector mapping
    sector_mapping = load_sector_mapping()
    
    # Get all unique securities without sector classification
    unclassified = holdings.find({
        '$or': [
            {'sector': {'$exists': False}},
            {'sector': None}
        ]
    })
    
    total = holdings.count_documents({
        '$or': [
            {'sector': {'$exists': False}},
            {'sector': None}
        ]
    })
    
    print(f"📊 Found {total} holdings to classify")
    print("=" * 70)
    
    classified_count = 0
    bulk_operations = []
    
    for holding in unclassified:
        security = holding['security']
        sector = classify_security(security, sector_mapping)
        
        bulk_operations.append({
            'updateOne': {
                'filter': {'_id': holding['_id']},
                'update': {'$set': {'sector': sector}}
            }
        })
        
        classified_count += 1
        
        if classified_count % 100 == 0:
            print(f"  Processed {classified_count}/{total}...")
        
        # Execute bulk operations in batches
        if len(bulk_operations) >= 1000:
            holdings.bulk_write(bulk_operations)
            bulk_operations = []
    
    # Execute remaining operations
    if bulk_operations:
        holdings.bulk_write(bulk_operations)
    
    print("\n" + "=" * 70)
    print(f"✅ Classified {classified_count} holdings")
    
    # Show sector distribution
    print("\n📊 Sector Distribution:")
    pipeline = [
        {'$group': {
            '_id': '$sector',
            'count': {'$sum': 1}
        }},
        {'$sort': {'count': -1}}
    ]
    
    for result in holdings.aggregate(pipeline):
        print(f"  {result['_id']:.<30} {result['count']:>6} holdings")

if __name__ == "__main__":
    print("=" * 70)
    print("🏢 Sector Classification Tool")
    print("=" * 70)
    
    classify_all_holdings()
    
    print("\n✅ Classification complete!")
