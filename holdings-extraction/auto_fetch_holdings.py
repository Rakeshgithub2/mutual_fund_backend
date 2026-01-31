"""
Automated Fund Holdings Scraper
Fetches real-world holdings from MoneyControl, ValueResearch, and other sources
"""

import requests
from bs4 import BeautifulSoup
from pymongo import MongoClient
from datetime import datetime
import time
import re
import os
from dotenv import load_dotenv

load_dotenv()

MONGODB_URI = os.getenv('MONGODB_URI', 'mongodb://localhost:27017/mutual-funds')

# User agent to mimic browser
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
}

def connect_db():
    """Connect to MongoDB"""
    client = MongoClient(MONGODB_URI)
    return client.get_database()

def scrape_moneycontrol_holdings(fund_name):
    """Scrape holdings from MoneyControl"""
    try:
        # Search for fund
        search_query = fund_name.replace(' ', '+')
        search_url = f"https://www.moneycontrol.com/mutual-funds/nav/search?query={search_query}"
        
        response = requests.get(search_url, headers=HEADERS, timeout=10)
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Find fund link
        fund_links = soup.find_all('a', href=re.compile(r'/mutual-funds/.*'))
        if not fund_links:
            return None
        
        fund_url = fund_links[0]['href']
        if not fund_url.startswith('http'):
            fund_url = 'https://www.moneycontrol.com' + fund_url
        
        # Add /portfolio to get holdings page
        portfolio_url = fund_url.replace('#nav', '') + '/portfolio'
        
        print(f"   Fetching from: {portfolio_url}")
        response = requests.get(portfolio_url, headers=HEADERS, timeout=10)
        soup = BeautifulSoup(response.text, 'html.parser')
        
        holdings = []
        
        # Find portfolio table
        tables = soup.find_all('table', class_='mctable1')
        for table in tables:
            rows = table.find_all('tr')
            for row in rows[1:]:  # Skip header
                cols = row.find_all('td')
                if len(cols) >= 3:
                    security = cols[0].get_text(strip=True)
                    weight_text = cols[1].get_text(strip=True)
                    
                    # Extract percentage
                    weight_match = re.search(r'(\d+\.?\d*)', weight_text)
                    if weight_match and security:
                        weight = float(weight_match.group(1))
                        
                        # Auto-classify sector
                        sector = classify_sector(security)
                        
                        holdings.append({
                            'security': security,
                            'weight': weight,
                            'sector': sector
                        })
        
        return holdings if holdings else None
        
    except Exception as e:
        print(f"   ⚠️  MoneyControl error: {str(e)[:50]}")
        return None

def scrape_valueresearch_holdings(fund_name):
    """Scrape holdings from ValueResearch"""
    try:
        # Search for fund
        search_query = fund_name.replace(' ', '-').lower()
        search_url = f"https://www.valueresearchonline.com/funds/newsnapshot.asp?schemecode={search_query}"
        
        response = requests.get(search_url, headers=HEADERS, timeout=10)
        soup = BeautifulSoup(response.text, 'html.parser')
        
        holdings = []
        
        # Find holdings section
        holding_divs = soup.find_all('div', class_='holdings-table')
        for div in holding_divs:
            rows = div.find_all('tr')
            for row in rows[1:]:  # Skip header
                cols = row.find_all('td')
                if len(cols) >= 2:
                    security = cols[0].get_text(strip=True)
                    weight_text = cols[1].get_text(strip=True)
                    
                    weight_match = re.search(r'(\d+\.?\d*)', weight_text)
                    if weight_match and security:
                        weight = float(weight_match.group(1))
                        sector = classify_sector(security)
                        
                        holdings.append({
                            'security': security,
                            'weight': weight,
                            'sector': sector
                        })
        
        return holdings if holdings else None
        
    except Exception as e:
        print(f"   ⚠️  ValueResearch error: {str(e)[:50]}")
        return None

def classify_sector(company_name):
    """Auto-classify sector based on company name"""
    company_lower = company_name.lower()
    
    # Banking
    if any(word in company_lower for word in ['bank', 'banking']):
        return 'Banking'
    
    # IT & Software
    if any(word in company_lower for word in ['tcs', 'infosys', 'wipro', 'tech', 'software', 'hcl', 'mindtree', 'persistent']):
        return 'IT & Software'
    
    # Pharma & Healthcare
    if any(word in company_lower for word in ['pharma', 'sun', 'cipla', 'reddy', 'lupin', 'biocon', 'divi', 'hospital', 'healthcare']):
        return 'Pharma & Healthcare'
    
    # FMCG
    if any(word in company_lower for word in ['unilever', 'hul', 'itc', 'britannia', 'nestle', 'dabur', 'marico', 'godrej consumer', 'tata consumer', 'colgate']):
        return 'FMCG'
    
    # Automobile
    if any(word in company_lower for word in ['maruti', 'tata motors', 'mahindra', 'bajaj auto', 'hero', 'tvs motor', 'eicher']):
        return 'Automobile'
    
    # Energy & Power
    if any(word in company_lower for word in ['reliance', 'ongc', 'oil', 'bpcl', 'hpcl', 'ntpc', 'power', 'coal', 'gail']):
        return 'Energy & Power'
    
    # Financial Services
    if any(word in company_lower for word in ['bajaj finance', 'bajaj finserv', 'finance', 'insurance', 'hdfc life', 'sbi life']):
        return 'Financial Services'
    
    # Telecom
    if any(word in company_lower for word in ['airtel', 'jio', 'vodafone', 'telecom']):
        return 'Telecom'
    
    # Infrastructure
    if any(word in company_lower for word in ['l&t', 'larsen', 'toubro', 'infrastructure', 'gmr', 'irb']):
        return 'Infrastructure'
    
    # Metals & Mining
    if any(word in company_lower for word in ['tata steel', 'jsw steel', 'hindalco', 'vedanta', 'steel', 'metal', 'mining']):
        return 'Metals & Mining'
    
    # Cement
    if any(word in company_lower for word in ['ultratech', 'cement', 'ambuja', 'acc']):
        return 'Cement'
    
    return 'Others'

def import_holdings_to_db(fund_data):
    """Import holdings to MongoDB"""
    db = connect_db()
    holdings_collection = db['fund_holdings']
    
    scheme_code = fund_data['scheme_code']
    fund_name = fund_data['fund_name']
    holdings = fund_data['holdings']
    
    # Delete existing holdings
    holdings_collection.delete_many({'schemeCode': scheme_code})
    
    # Insert new holdings
    report_date = datetime.now()
    holdings_docs = []
    
    for h in holdings:
        doc = {
            'schemeCode': scheme_code,
            'fundName': fund_name,
            'security': h['security'],
            'weight': h['weight'],
            'sector': h['sector'],
            'marketValue': h.get('market_value'),
            'reportDate': report_date,
            'source': 'AUTO_SCRAPE',
            'importedAt': datetime.now()
        }
        holdings_docs.append(doc)
    
    if holdings_docs:
        holdings_collection.insert_many(holdings_docs)
        return len(holdings_docs)
    
    return 0

def auto_fetch_holdings_for_fund(scheme_code, fund_name):
    """Automatically fetch holdings for a fund"""
    print(f"\n{'='*70}")
    print(f"📥 Fetching holdings for: {fund_name}")
    print(f"{'='*70}")
    
    holdings = None
    
    # Try MoneyControl first
    print("   🔍 Trying MoneyControl...")
    holdings = scrape_moneycontrol_holdings(fund_name)
    
    # If failed, try ValueResearch
    if not holdings:
        print("   🔍 Trying ValueResearch...")
        time.sleep(2)  # Rate limiting
        holdings = scrape_valueresearch_holdings(fund_name)
    
    if holdings:
        print(f"   ✅ Found {len(holdings)} holdings")
        
        # Import to database
        fund_data = {
            'scheme_code': scheme_code,
            'fund_name': fund_name,
            'holdings': holdings
        }
        
        count = import_holdings_to_db(fund_data)
        
        if count > 0:
            print(f"   ✅ Imported {count} holdings to database")
            print(f"\n   📊 Top 5 Holdings:")
            for i, h in enumerate(holdings[:5], 1):
                print(f"      {i}. {h['security'][:40]:.<40} {h['weight']:>5.2f}% ({h['sector']})")
            return True
        
    else:
        print("   ❌ Could not fetch holdings")
        print("   💡 Try:")
        print(f"      1. Visit fund website manually")
        print(f"      2. Use: node add-fund-holdings.js")
        return False

def auto_fetch_popular_funds():
    """Auto-fetch holdings for popular funds"""
    print("\n" + "="*70)
    print("🤖 AUTOMATED HOLDINGS FETCHER")
    print("="*70)
    
    # Connect to database
    db = connect_db()
    funds_collection = db['funds']
    
    # Get funds from database
    popular_funds = list(funds_collection.find({
        'schemeCode': {'$ne': None, '$exists': True}
    }).limit(20))
    
    if not popular_funds:
        print("\n❌ No funds found in database")
        print("   Add funds first with seed scripts")
        return
    
    print(f"\n📋 Found {len(popular_funds)} funds in database")
    print("   Fetching holdings for each...\n")
    
    success_count = 0
    fail_count = 0
    
    for i, fund in enumerate(popular_funds, 1):
        scheme_code = fund.get('schemeCode')
        fund_name = fund.get('schemeName') or fund.get('name', 'Unknown')
        
        print(f"\n[{i}/{len(popular_funds)}] Processing...")
        
        success = auto_fetch_holdings_for_fund(scheme_code, fund_name)
        
        if success:
            success_count += 1
        else:
            fail_count += 1
        
        # Rate limiting - be respectful to websites
        time.sleep(3)
        
        # Stop after 5 successful fetches (demo)
        if success_count >= 5:
            print(f"\n✅ Successfully fetched 5 funds. Stopping for now.")
            break
    
    print("\n" + "="*70)
    print("📊 SUMMARY")
    print("="*70)
    print(f"   ✅ Successful: {success_count}")
    print(f"   ❌ Failed: {fail_count}")
    print(f"\n   🎯 Test API: curl http://localhost:3002/api/holdings/stats")

if __name__ == "__main__":
    auto_fetch_popular_funds()
