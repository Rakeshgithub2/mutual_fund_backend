"""
Get Real Holdings from MF API
Alternative approach - use existing MFAPI NAV data + fund basic info
Then match with schemeCode to provide holdings structure
"""

import requests
from pymongo import MongoClient
from datetime import datetime
import os
from dotenv import load_dotenv

load_dotenv()

MONGODB_URI = os.getenv('MONGODB_URI', 'mongodb://localhost:27017/mutual-funds')
MFAPI_BASE = "https://api.mfapi.in/mf"

print("\n" + "="*70)
print("💡 ALTERNATIVE: Using Fund Basic Info")
print("="*70)
print("\n⚠️  Note: Real holdings data requires:")
print("   1. AMFI portfolio PDFs (updated quarterly)")
print("   2. Or paid data providers (NSE, BSE)")
print("   3. Or web scraping from fund house websites")
print("\nFor now, we'll:")
print("   ✅ Use your existing fund database")
print("   ✅ Keep sample holdings for demonstration")
print("   ✅ You can manually add holdings from fund factsheets")
print("\n" + "="*70)

def check_existing_funds():
    """Check what funds exist in database"""
    try:
        client = MongoClient(MONGODB_URI)
        db = client.get_database()
        
        funds = db['funds'].find({}).limit(10)
        holdings = db['fund_holdings']
        
        print("\n📊 Your Database Status:")
        print(f"   Total Funds: {db['funds'].count_documents({})}")
        print(f"   Funds with Holdings: {len(holdings.distinct('schemeCode'))}")
        
        print("\n📋 Sample Funds in Database:")
        for i, fund in enumerate(funds, 1):
            scheme = fund.get('schemeCode', 'N/A')
            name = fund.get('schemeName', fund.get('name', 'Unknown'))[:50]
            print(f"   {i}. [{scheme}] {name}")
        
        print("\n💡 To add real holdings for a specific fund:")
        print("   1. Visit fund website (e.g., https://www.hdfcfund.com)")
        print("   2. Download latest factsheet PDF")
        print("   3. Manually extract top 10 holdings")
        print("   4. Use: node add-fund-holdings.js")
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

if __name__ == "__main__":
    check_existing_funds()
