import urllib.request
import json

SUPABASE_URL = "https://krxhrbtlgfjzsseegaqq.supabase.co"
SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyeGhyYnRsZ2ZqenNzZWVnYXFxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzAyMTQxMSwiZXhwIjoyMDc4NTk3NDExfQ.nog3UX9J9OgfqlCIPJt_sU_exE6Ny-nSj_HmwgV3oA8"

headers = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json"
}

# 4998の気づきデータを確認
url = f"{SUPABASE_URL}/rest/v1/buyers?buyer_number=eq.4998&select=buyer_number,viewing_insight_executor,viewing_insight_companion,deleted_at"
req = urllib.request.Request(url, headers=headers)
with urllib.request.urlopen(req) as res:
    data = json.loads(res.read())
    print("=== 4998の気づきデータ ===")
    for row in data:
        print(f"buyer_number: {row.get('buyer_number')}")
        print(f"viewing_insight_executor: {repr(row.get('viewing_insight_executor'))}")
        print(f"viewing_insight_companion: {repr(row.get('viewing_insight_companion'))}")
        print(f"deleted_at: {row.get('deleted_at')}")

# 気づきが入力されている全買主を確認
url2 = f"{SUPABASE_URL}/rest/v1/buyers?select=buyer_number,viewing_insight_executor,viewing_insight_companion&deleted_at=is.null&or=(viewing_insight_executor.not.is.null,viewing_insight_companion.not.is.null)"
req2 = urllib.request.Request(url2, headers=headers)
with urllib.request.urlopen(req2) as res:
    data2 = json.loads(res.read())
    print(f"\n=== 気づきがNULLでない買主数: {len(data2)} ===")
    for row in data2:
        exec_val = row.get('viewing_insight_executor') or ''
        comp_val = row.get('viewing_insight_companion') or ''
        if exec_val.strip() or comp_val.strip():
            print(f"  buyer_number: {row.get('buyer_number')}, executor: {repr(exec_val[:30])}, companion: {repr(comp_val[:30])}")
