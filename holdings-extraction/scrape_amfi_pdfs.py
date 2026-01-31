"""
AMFI Portfolio PDF Scraper
Scrapes portfolio disclosure PDFs from AMFI website
"""

import requests
from bs4 import BeautifulSoup
import os
import json
from datetime import datetime
import time

AMFI_URL = "https://www.amfiindia.com/research-information/portfolio-disclosures"
PDF_DIR = "pdfs"
METADATA_FILE = "pdf_metadata.json"

def scrape_pdf_links():
    """Scrape all portfolio PDF links from AMFI website"""
    print("🔍 Scraping AMFI website for portfolio PDFs...")
    
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        response = requests.get(AMFI_URL, headers=headers, timeout=30)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        pdf_links = []
        for link in soup.find_all('a', href=True):
            href = link['href']
            
            # Filter for portfolio PDFs
            if '.pdf' in href.lower() and ('portfolio' in href.lower() or 'holding' in href.lower()):
                # Handle relative and absolute URLs
                if href.startswith('http'):
                    full_url = href
                elif href.startswith('/'):
                    full_url = f"https://www.amfiindia.com{href}"
                else:
                    full_url = f"https://www.amfiindia.com/{href}"
                
                # Extract fund name from link text or URL
                fund_name = link.get_text(strip=True) or href.split('/')[-1].replace('.pdf', '')
                
                pdf_links.append({
                    'url': full_url,
                    'fund_name': fund_name,
                    'filename': href.split('/')[-1],
                    'scraped_at': datetime.now().isoformat()
                })
        
        print(f"✅ Found {len(pdf_links)} portfolio PDFs")
        return pdf_links
    
    except Exception as e:
        print(f"❌ Error scraping AMFI website: {e}")
        return []

def download_pdfs(pdf_links, max_downloads=None):
    """Download PDFs with rate limiting"""
    os.makedirs(PDF_DIR, exist_ok=True)
    
    downloaded = []
    failed = []
    
    # Limit downloads if specified
    links_to_download = pdf_links[:max_downloads] if max_downloads else pdf_links
    
    print(f"\n📥 Downloading {len(links_to_download)} PDFs...")
    
    for idx, pdf_info in enumerate(links_to_download, 1):
        try:
            print(f"  [{idx}/{len(links_to_download)}] {pdf_info['filename'][:50]}...", end=' ')
            
            response = requests.get(pdf_info['url'], timeout=60)
            response.raise_for_status()
            
            filepath = os.path.join(PDF_DIR, pdf_info['filename'])
            with open(filepath, 'wb') as f:
                f.write(response.content)
            
            pdf_info['local_path'] = filepath
            pdf_info['downloaded_at'] = datetime.now().isoformat()
            pdf_info['file_size'] = len(response.content)
            downloaded.append(pdf_info)
            
            print("✅")
            
            # Rate limiting - be respectful to AMFI servers
            time.sleep(2)
            
        except Exception as e:
            print(f"❌ {str(e)[:50]}")
            pdf_info['error'] = str(e)
            failed.append(pdf_info)
    
    # Save metadata
    metadata = {
        'last_scraped': datetime.now().isoformat(),
        'total_found': len(pdf_links),
        'downloaded': len(downloaded),
        'failed': len(failed),
        'pdfs': downloaded
    }
    
    with open(METADATA_FILE, 'w') as f:
        json.dump(metadata, f, indent=2)
    
    print(f"\n✅ Downloaded: {len(downloaded)}")
    print(f"❌ Failed: {len(failed)}")
    print(f"📄 Metadata saved to {METADATA_FILE}")
    
    return downloaded, failed

if __name__ == "__main__":
    print("=" * 60)
    print("🏦 AMFI Portfolio PDF Scraper")
    print("=" * 60)
    
    # Scrape PDF links
    pdf_links = scrape_pdf_links()
    
    if not pdf_links:
        print("⚠️  No PDFs found. Check AMFI website structure.")
        exit(1)
    
    # Show first 5 for verification
    print("\n📋 Sample PDFs found:")
    for pdf in pdf_links[:5]:
        print(f"  • {pdf['fund_name'][:60]}")
    
    # Ask for confirmation
    response = input(f"\nDownload all {len(pdf_links)} PDFs? (y/n): ").lower()
    
    if response == 'y':
        downloaded, failed = download_pdfs(pdf_links)
        print("\n✅ Scraping complete!")
    else:
        # Download only first 5 for testing
        print("\nDownloading first 5 PDFs for testing...")
        downloaded, failed = download_pdfs(pdf_links, max_downloads=5)
