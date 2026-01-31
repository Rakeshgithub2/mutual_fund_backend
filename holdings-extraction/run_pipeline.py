"""
Complete Holdings Extraction Pipeline
Orchestrates the entire process from scraping to database import
"""

import subprocess
import sys
import os
from datetime import datetime

def run_step(step_name, script_path, description):
    """Run a pipeline step"""
    print("\n" + "=" * 70)
    print(f"🚀 STEP: {step_name}")
    print(f"📝 {description}")
    print("=" * 70)
    
    try:
        result = subprocess.run(
            [sys.executable, script_path],
            check=True,
            capture_output=False,
            text=True
        )
        print(f"✅ {step_name} completed successfully")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ {step_name} failed with error code {e.returncode}")
        return False
    except Exception as e:
        print(f"❌ {step_name} failed: {str(e)}")
        return False

def main():
    """Run the complete pipeline"""
    print("\n")
    print("╔" + "=" * 68 + "╗")
    print("║" + " " * 15 + "HOLDINGS EXTRACTION PIPELINE" + " " * 25 + "║")
    print("║" + " " * 10 + "Complete Fund Portfolio Data Extraction" + " " * 19 + "║")
    print("╚" + "=" * 68 + "╝")
    
    start_time = datetime.now()
    
    # Pipeline steps
    steps = [
        {
            'name': '1. Scrape AMFI PDFs',
            'script': 'scrape_amfi_pdfs.py',
            'description': 'Download portfolio disclosure PDFs from AMFI website'
        },
        {
            'name': '2. Parse Holdings',
            'script': 'parse_holdings.py',
            'description': 'Extract holdings data from PDFs using tabula'
        },
        {
            'name': '3. Import to MongoDB',
            'script': 'import_to_mongodb.py',
            'description': 'Load parsed holdings into database'
        },
        {
            'name': '4. Classify Sectors',
            'script': 'classify_sectors.py',
            'description': 'Auto-classify securities into sectors'
        }
    ]
    
    # Run each step
    results = []
    for step in steps:
        success = run_step(
            step['name'],
            step['script'],
            step['description']
        )
        results.append({'step': step['name'], 'success': success})
        
        if not success:
            print(f"\n⚠️  Pipeline stopped at: {step['name']}")
            break
    
    # Summary
    end_time = datetime.now()
    duration = (end_time - start_time).total_seconds()
    
    print("\n\n" + "=" * 70)
    print("📊 PIPELINE SUMMARY")
    print("=" * 70)
    
    for result in results:
        status = "✅ SUCCESS" if result['success'] else "❌ FAILED"
        print(f"{status} - {result['step']}")
    
    print("\n" + "=" * 70)
    print(f"⏱️  Total time: {duration:.1f} seconds")
    
    all_success = all(r['success'] for r in results)
    if all_success:
        print("✅ All steps completed successfully!")
        print("\n🎉 Holdings data is now available in your database")
        print("📡 API endpoints are ready to serve holdings data")
    else:
        print("⚠️  Some steps failed. Please check the logs above.")
        sys.exit(1)

if __name__ == "__main__":
    # Check if we're in the right directory
    if not os.path.exists('requirements.txt'):
        print("❌ Error: Run this script from the holdings-extraction directory")
        print("   cd holdings-extraction")
        print("   python run_pipeline.py")
        sys.exit(1)
    
    main()
