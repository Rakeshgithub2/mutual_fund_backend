"""
Portfolio PDF Parser
Extract holdings data from portfolio disclosure PDFs
"""

import tabula
import pandas as pd
import os
import json
from datetime import datetime
import re

PDF_DIR = "pdfs"
OUTPUT_DIR = "parsed_holdings"
METADATA_FILE = "pdf_metadata.json"

def clean_percentage(value):
    """Clean percentage strings"""
    if pd.isna(value):
        return None
    value_str = str(value).strip()
    value_str = re.sub(r'[%,]', '', value_str)
    try:
        return float(value_str)
    except:
        return None

def clean_amount(value):
    """Clean monetary amounts"""
    if pd.isna(value):
        return None
    value_str = str(value).strip()
    value_str = re.sub(r'[,₹Rs\s]', '', value_str)
    try:
        return float(value_str)
    except:
        return None

def parse_pdf(pdf_path):
    """Extract holdings table from PDF"""
    print(f"📄 Parsing: {os.path.basename(pdf_path)[:50]}...", end=' ')
    
    try:
        # Try to extract tables from all pages
        dfs = tabula.read_pdf(
            pdf_path,
            pages='all',
            multiple_tables=True,
            lattice=True,
            pandas_options={'header': 0}
        )
        
        if not dfs:
            print("⚠️  No tables found")
            return None
        
        # Combine all tables
        combined_df = pd.concat(dfs, ignore_index=True)
        
        # Identify columns (different AMCs use different headers)
        possible_security_cols = ['Name of the Instrument', 'Security', 'Name', 'Instrument', 'Company']
        possible_weight_cols = ['% to Net Assets', '% to NAV', 'Weight', 'Percentage', '%']
        possible_value_cols = ['Market/Fair Value', 'Market Value', 'Value', 'Amount']
        
        # Find matching columns
        security_col = next((col for col in combined_df.columns if any(s in col for s in possible_security_cols)), None)
        weight_col = next((col for col in combined_df.columns if any(w in col for w in possible_weight_cols)), None)
        value_col = next((col for col in combined_df.columns if any(v in col for v in possible_value_cols)), None)
        
        if not security_col:
            print("⚠️  Could not identify security column")
            return None
        
        # Extract relevant columns
        result = pd.DataFrame()
        result['security'] = combined_df[security_col] if security_col else None
        result['weight'] = combined_df[weight_col].apply(clean_percentage) if weight_col else None
        result['market_value'] = combined_df[value_col].apply(clean_amount) if value_col else None
        
        # Clean data
        result = result.dropna(subset=['security'])
        result = result[result['security'].str.len() > 3]  # Remove invalid entries
        
        # Remove header rows that got repeated
        result = result[~result['security'].str.contains('Name|Security|Instrument', case=False, na=False)]
        
        print(f"✅ {len(result)} holdings")
        return result
        
    except Exception as e:
        print(f"❌ {str(e)[:50]}")
        return None

def parse_all_pdfs():
    """Parse all downloaded PDFs"""
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    # Load metadata to get PDF info
    if not os.path.exists(METADATA_FILE):
        print("❌ No metadata file found. Run scrape_amfi_pdfs.py first.")
        return
    
    with open(METADATA_FILE, 'r') as f:
        metadata = json.load(f)
    
    parsed_data = []
    
    print(f"\n🔄 Parsing {len(metadata['pdfs'])} PDFs...")
    print("=" * 70)
    
    for pdf_info in metadata['pdfs']:
        if 'local_path' not in pdf_info:
            continue
        
        pdf_path = pdf_info['local_path']
        if not os.path.exists(pdf_path):
            print(f"⚠️  File not found: {pdf_path}")
            continue
        
        # Parse PDF
        holdings_df = parse_pdf(pdf_path)
        
        if holdings_df is not None and len(holdings_df) > 0:
            # Save individual fund holdings
            filename = os.path.basename(pdf_path).replace('.pdf', '.json')
            output_path = os.path.join(OUTPUT_DIR, filename)
            
            holdings_data = {
                'fund_name': pdf_info['fund_name'],
                'filename': pdf_info['filename'],
                'parsed_at': datetime.now().isoformat(),
                'total_holdings': len(holdings_df),
                'holdings': holdings_df.to_dict('records')
            }
            
            with open(output_path, 'w') as f:
                json.dump(holdings_data, f, indent=2)
            
            parsed_data.append({
                'fund_name': pdf_info['fund_name'],
                'filename': filename,
                'holdings_count': len(holdings_df),
                'output_file': output_path
            })
    
    # Save summary
    summary = {
        'parsed_at': datetime.now().isoformat(),
        'total_parsed': len(parsed_data),
        'funds': parsed_data
    }
    
    summary_path = os.path.join(OUTPUT_DIR, '_summary.json')
    with open(summary_path, 'w') as f:
        json.dump(summary, f, indent=2)
    
    print("\n" + "=" * 70)
    print(f"✅ Successfully parsed {len(parsed_data)} funds")
    print(f"📁 Output saved to: {OUTPUT_DIR}/")
    print(f"📊 Summary: {summary_path}")

if __name__ == "__main__":
    print("=" * 70)
    print("📊 Portfolio PDF Parser")
    print("=" * 70)
    
    parse_all_pdfs()
