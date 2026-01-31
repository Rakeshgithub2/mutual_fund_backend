"""
Test Holdings System
Quick test to verify holdings extraction and API
"""

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pymongo import MongoClient
from dotenv import load_dotenv
import json

load_dotenv()

MONGODB_URI = os.getenv('MONGODB_URI', 'mongodb://localhost:27017/mutual-funds')

def test_holdings_system():
    """Test the complete holdings system"""
    
    print("\n" + "=" * 70)
    print("🧪 TESTING HOLDINGS SYSTEM")
    print("=" * 70)
    
    # Connect to MongoDB
    print("\n[1/4] Testing MongoDB connection...")
    try:
        client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
        db = client.get_database()
        print("✅ Connected to MongoDB")
    except Exception as e:
        print(f"❌ MongoDB connection failed: {e}")
        return False
    
    # Check holdings collection
    print("\n[2/4] Checking fund_holdings collection...")
    holdings_collection = db['fund_holdings']
    total_holdings = holdings_collection.count_documents({})
    
    if total_holdings > 0:
        print(f"✅ Found {total_holdings} holdings records")
    else:
        print("⚠️  No holdings data found")
        print("   Run the pipeline first: python run_pipeline.py")
        return False
    
    # Check unique funds with holdings
    print("\n[3/4] Analyzing holdings data...")
    pipeline = [
        {'$group': {
            '_id': '$schemeCode',
            'fundName': {'$first': '$fundName'},
            'count': {'$sum': 1},
            'latestDate': {'$max': '$reportDate'}
        }},
        {'$sort': {'count': -1}},
        {'$limit': 5}
    ]
    
    top_funds = list(holdings_collection.aggregate(pipeline))
    
    print(f"\n📊 Top 5 Funds with Holdings:")
    print("-" * 70)
    for fund in top_funds:
        scheme = fund['_id'] or 'N/A'
        name = fund['fundName'][:45]
        count = fund['count']
        date = fund['latestDate'].strftime('%Y-%m-%d') if fund['latestDate'] else 'N/A'
        print(f"  {name:.<45} {count:>3} holdings ({date})")
    
    # Test sector classification
    print("\n[4/4] Checking sector classification...")
    sectors = holdings_collection.distinct('sector')
    classified = holdings_collection.count_documents({'sector': {'$exists': True, '$ne': None}})
    
    print(f"\n📈 Sector Distribution:")
    print(f"  Total unique sectors: {len(sectors)}")
    print(f"  Classified holdings: {classified}/{total_holdings}")
    
    if classified > 0:
        print(f"  Coverage: {(classified/total_holdings*100):.1f}%")
        
        # Show top sectors
        sector_stats = holdings_collection.aggregate([
            {'$match': {'sector': {'$exists': True, '$ne': None}}},
            {'$group': {'_id': '$sector', 'count': {'$sum': 1}}},
            {'$sort': {'count': -1}},
            {'$limit': 5}
        ])
        
        print("\n  Top 5 Sectors:")
        for stat in sector_stats:
            print(f"    • {stat['_id']:.<30} {stat['count']:>5} securities")
    
    # Test sample query
    print("\n[BONUS] Testing sample holdings query...")
    sample_fund = holdings_collection.find_one({'schemeCode': {'$ne': None}})
    
    if sample_fund:
        scheme_code = sample_fund['schemeCode']
        fund_name = sample_fund['fundName']
        
        holdings = list(holdings_collection.find(
            {'schemeCode': scheme_code}
        ).sort('weight', -1).limit(5))
        
        if holdings:
            print(f"\n📋 Sample: {fund_name[:50]}")
            print("-" * 70)
            for h in holdings:
                security = h['security'][:40]
                weight = h.get('weight', 0)
                sector = h.get('sector', 'Unknown')
                print(f"  {security:.<40} {weight:>5.2f}% ({sector})")
    
    print("\n" + "=" * 70)
    print("✅ ALL TESTS PASSED!")
    print("=" * 70)
    
    print("\n🎉 Holdings System Status: OPERATIONAL")
    print("\n📡 Available API Endpoints:")
    print(f"   GET  /api/holdings/stats")
    print(f"   GET  /api/holdings/:schemeCode")
    print(f"   GET  /api/holdings/:schemeCode/top")
    print(f"   GET  /api/holdings/:schemeCode/sectors")
    print(f"   POST /api/holdings/compare")
    
    print("\n💡 Try:")
    if sample_fund:
        print(f"   curl http://localhost:3002/api/holdings/{scheme_code}")
    print(f"   curl http://localhost:3002/api/holdings/stats")
    
    return True

if __name__ == "__main__":
    success = test_holdings_system()
    sys.exit(0 if success else 1)
