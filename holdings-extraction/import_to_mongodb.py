"""
Import Holdings to MongoDB
Load parsed holdings data into MongoDB
"""

import json
import os
from pymongo import MongoClient, ASCENDING
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

PARSED_DIR = "parsed_holdings"
MONGODB_URI = os.getenv('MONGODB_URI', 'mongodb://localhost:27017/mutual-funds')

def connect_to_mongodb():
    """Connect to MongoDB"""
    print("🔌 Connecting to MongoDB...")
    client = MongoClient(MONGODB_URI)
    db = client.get_database()
    return db

def create_indexes(db):
    """Create indexes for efficient queries"""
    print("📇 Creating indexes...")
    
    holdings = db['fund_holdings']
    
    # Create indexes
    holdings.create_index([('schemeCode', ASCENDING)])
    holdings.create_index([('fundName', ASCENDING)])
    holdings.create_index([('reportDate', ASCENDING)])
    holdings.create_index([('schemeCode', ASCENDING), ('reportDate', ASCENDING)])
    
    print("✅ Indexes created")

def import_holdings(db):
    """Import all parsed holdings to MongoDB"""
    
    if not os.path.exists(PARSED_DIR):
        print(f"❌ Directory not found: {PARSED_DIR}")
        return
    
    holdings_collection = db['fund_holdings']
    
    # Read all JSON files
    json_files = [f for f in os.listdir(PARSED_DIR) if f.endswith('.json') and not f.startswith('_')]
    
    print(f"\n📥 Importing {len(json_files)} funds to MongoDB...")
    print("=" * 70)
    
    imported_count = 0
    skipped_count = 0
    
    for json_file in json_files:
        filepath = os.path.join(PARSED_DIR, json_file)
        
        try:
            with open(filepath, 'r') as f:
                data = json.load(f)
            
            fund_name = data['fund_name']
            holdings = data['holdings']
            
            if not holdings:
                print(f"⚠️  {fund_name[:50]} - No holdings data")
                skipped_count += 1
                continue
            
            # Try to match with existing funds in database
            fund = db['funds'].find_one({
                '$or': [
                    {'schemeName': {'$regex': fund_name.split()[0], '$options': 'i'}},
                    {'name': {'$regex': fund_name.split()[0], '$options': 'i'}}
                ]
            })
            
            scheme_code = fund['schemeCode'] if fund and 'schemeCode' in fund else None
            
            # Prepare holdings documents
            report_date = datetime.now().replace(day=1)  # First day of current month
            
            # Clear existing holdings for this fund and date
            if scheme_code:
                holdings_collection.delete_many({
                    'schemeCode': scheme_code,
                    'reportDate': report_date
                })
            
            holdings_docs = []
            for holding in holdings:
                doc = {
                    'schemeCode': scheme_code,
                    'fundName': fund_name,
                    'security': holding.get('security'),
                    'weight': holding.get('weight'),
                    'marketValue': holding.get('market_value'),
                    'reportDate': report_date,
                    'importedAt': datetime.now(),
                    'source': 'AMFI_PDF'
                }
                holdings_docs.append(doc)
            
            # Bulk insert
            if holdings_docs:
                holdings_collection.insert_many(holdings_docs)
                print(f"✅ {fund_name[:50]} - {len(holdings_docs)} holdings")
                imported_count += 1
            
        except Exception as e:
            print(f"❌ {json_file[:50]} - Error: {str(e)[:50]}")
            skipped_count += 1
    
    print("\n" + "=" * 70)
    print(f"✅ Imported: {imported_count} funds")
    print(f"⚠️  Skipped: {skipped_count} funds")
    
    # Show collection stats
    total_holdings = holdings_collection.count_documents({})
    print(f"📊 Total holdings in database: {total_holdings}")

if __name__ == "__main__":
    print("=" * 70)
    print("📦 MongoDB Holdings Importer")
    print("=" * 70)
    
    db = connect_to_mongodb()
    create_indexes(db)
    import_holdings(db)
    
    print("\n✅ Import complete!")
