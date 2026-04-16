import urllib.request
import json

SUPABASE_URL = "https://krxhrbtlgfjzsseegaqq.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyeGhyYnRsZ2ZqenNzZWVnYXFxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzAyMTQxMSwiZXhwIjoyMDc4NTk3NDExfQ.nog3UX9J9OgfqlCIPJt_sU_exE6Ny-nSj_HmwgV3oA8"

# BB14の物件情報を確認
url = f"{SUPABASE_URL}/rest/v1/property_listings?property_number=eq.BB14&select=property_number,sales_assignee,display_address,address"
req = urllib.request.Request(url, headers={
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
})
with urllib.request.urlopen(req) as res:
    data = json.loads(res.read())
    print("=== BB14 物件情報 ===")
    for row in data:
        print(f"  property_number: {row.get('property_number')}")
        print(f"  sales_assignee: '{row.get('sales_assignee')}'")
        print(f"  display_address: '{row.get('display_address')}'")
        print(f"  address: '{row.get('address')}'")

# 4216の買主情報を確認
url2 = f"{SUPABASE_URL}/rest/v1/buyers?buyer_number=eq.4216&select=buyer_number,follow_up_assignee,viewing_date,viewing_time,viewing_mobile,viewing_type_general,property_number,inquiry_hearing"
req2 = urllib.request.Request(url2, headers={
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
})
with urllib.request.urlopen(req2) as res2:
    data2 = json.loads(res2.read())
    print("\n=== 4216 買主情報 ===")
    for row in data2:
        print(f"  buyer_number: {row.get('buyer_number')}")
        print(f"  follow_up_assignee: '{row.get('follow_up_assignee')}'")
        print(f"  viewing_date: '{row.get('viewing_date')}'")
        print(f"  viewing_time: '{row.get('viewing_time')}'")
        print(f"  viewing_mobile: '{row.get('viewing_mobile')}'")
        print(f"  viewing_type_general: '{row.get('viewing_type_general')}'")
        print(f"  property_number: '{row.get('property_number')}'")
