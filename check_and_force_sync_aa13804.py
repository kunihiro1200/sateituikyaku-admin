"""
AA13804 の visit_reminder_assignee を確認し、強制同期するスクリプト
"""
import urllib.request
import urllib.parse
import json
import os

SUPABASE_URL = "https://krxhrbtlgfjzsseegaqq.supabase.co"
SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyeGhyYnRsZ2ZqenNzZWVnYXFxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzAyMTQxMSwiZXhwIjoyMDc4NTk3NDExfQ.nog3UX9J9OgfqlCIPJt_sU_exE6Ny-nSj_HmwgV3oA8"

headers = {
    "apikey": SUPABASE_SERVICE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
    "Content-Type": "application/json",
}

def supabase_get(path):
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())

# AA13804 の現在の状態を確認
print("=== AA13804 の現在の DB 状態 ===")
data = supabase_get("sellers?seller_number=eq.AA13804&select=seller_number,visit_reminder_assignee,visit_assignee,visit_date,status")
if data:
    seller = data[0]
    print(f"  seller_number: {seller.get('seller_number')}")
    print(f"  visit_reminder_assignee: {seller.get('visit_reminder_assignee')!r}")
    print(f"  visit_assignee: {seller.get('visit_assignee')!r}")
    print(f"  visit_date: {seller.get('visit_date')!r}")
    print(f"  status: {seller.get('status')!r}")
else:
    print("  AA13804 が見つかりません")
