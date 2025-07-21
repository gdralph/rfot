#!/usr/bin/env python3
"""
Simple test script for the resources API endpoints.
"""
import requests
import json
from datetime import datetime


def test_api():
    base_url = "http://localhost:8000"
    
    print("🧪 Testing Resource Timeline API")
    print("=" * 50)
    
    # Test 1: Check health
    try:
        response = requests.get(f"{base_url}/api/health", timeout=5)
        if response.status_code == 200:
            print("✅ Health check passed")
        else:
            print(f"❌ Health check failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Health check error: {e}")
        return
    
    # Test 2: Get sample opportunities 
    try:
        response = requests.get(f"{base_url}/api/opportunities", timeout=10)
        if response.status_code == 200:
            opportunities = response.json()
            print(f"✅ Found {len(opportunities)} opportunities")
            
            # Find an opportunity with MW or ITOC revenue and decision date
            test_opp = None
            for opp in opportunities[:10]:  # Check first 10
                if opp.get('decision_date') and (
                    (opp.get('mw_millions') and opp.get('mw_millions') > 0) or 
                    (opp.get('itoc_millions') and opp.get('itoc_millions') > 0)
                ):
                    test_opp = opp
                    break
            
            if test_opp:
                print(f"✅ Found test opportunity: {test_opp['opportunity_id']}")
                print(f"   - Name: {test_opp['opportunity_name']}")
                print(f"   - TCV: ${test_opp.get('tcv_millions', 0)}M")
                print(f"   - Decision Date: {test_opp['decision_date']}")
                print(f"   - MW Revenue: ${test_opp.get('mw_millions', 0)}M")
                print(f"   - ITOC Revenue: ${test_opp.get('itoc_millions', 0)}M")
                print(f"   - Current Stage: {test_opp.get('sales_stage', 'Not set')}")
                
                # Test 3: Calculate timeline
                print("\n🔄 Calculating resource timeline...")
                try:
                    response = requests.post(
                        f"{base_url}/api/resources/calculate-timeline/{test_opp['opportunity_id']}",
                        timeout=10
                    )
                    if response.status_code == 200:
                        timeline_data = response.json()
                        print("✅ Timeline calculation successful!")
                        print(f"   - Total Effort: {timeline_data['total_remaining_effort_weeks']:.1f} weeks")
                        print(f"   - Service Lines: {', '.join(timeline_data['supported_service_lines'])}")
                        print(f"   - Category: {timeline_data['category']}")
                        
                        # Show stage breakdown
                        for service_line, stages in timeline_data['service_line_timelines'].items():
                            print(f"\n   📊 {service_line} Service Line Timeline:")
                            for stage in stages:
                                print(f"      {stage['stage_name']}: {stage['stage_start_date'][:10]} to {stage['stage_end_date'][:10]} ({stage['total_effort_weeks']:.1f} FTE-weeks)")
                        
                        # Test 4: Retrieve stored timeline
                        print("\n🔍 Retrieving stored timeline...")
                        response = requests.get(
                            f"{base_url}/api/resources/opportunity/{test_opp['opportunity_id']}/timeline",
                            timeout=10
                        )
                        if response.status_code == 200:
                            print("✅ Timeline retrieval successful!")
                        else:
                            print(f"❌ Timeline retrieval failed: {response.status_code}")
                            
                    else:
                        print(f"❌ Timeline calculation failed: {response.status_code}")
                        print(f"   Error: {response.text}")
                        
                except Exception as e:
                    print(f"❌ Timeline calculation error: {e}")
                    
            else:
                print("❌ No suitable test opportunity found (need MW/ITOC revenue and decision date)")
                
        else:
            print(f"❌ Failed to get opportunities: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Opportunities API error: {e}")
    
    # Test 5: Portfolio forecast
    print("\n📈 Testing portfolio forecast...")
    try:
        response = requests.get(f"{base_url}/api/resources/portfolio/resource-forecast", timeout=10)
        if response.status_code == 200:
            forecast = response.json()
            print("✅ Portfolio forecast successful!")
            print(f"   - Opportunities processed: {forecast['total_opportunities_processed']}")
            print(f"   - Total effort: {forecast['total_effort_weeks']:.1f} weeks")
            print(f"   - MW effort: {forecast['service_line_breakdown']['MW']:.1f} weeks")
            print(f"   - ITOC effort: {forecast['service_line_breakdown']['ITOC']:.1f} weeks")
        else:
            print(f"❌ Portfolio forecast failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Portfolio forecast error: {e}")

    print("\n" + "=" * 50)
    print("🎉 Testing complete!")


if __name__ == "__main__":
    test_api()