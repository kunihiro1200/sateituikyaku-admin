import urllib.request
import json

SUPABASE_URL = "https://krxhrbtlgfjzsseegaqq.supabase.co"
SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyeGhyYnRsZ2ZqenNzZWVnYXFxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzAyMTQxMSwiZXhwIjoyMDc4NTk3NDExfQ.nog3UX9J9OgfqlCIPJt_sU_exE6Ny-nSj_HmwgV3oA8"

headers = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Range": "0-9999",
}

# 全件取得（Prefer: count=exact で件数も取得）
headers2 = dict(headers)
headers2["Prefer"] = "count=exact"

url = f"{SUPABASE_URL}/rest/v1/buyers?select=buyer_number,viewing_insight_executor,viewing_insight_companion&deleted_at=is.null"
req = urllib.request.Request(url, headers=headers2)
with urllib.request.urlopen(req) as res:
    total = res.headers.get('Content-Range', 'unknown')
    data = json.loads(res.read())
    print(f"総件数: {total}, 取得件数: {len(data)}")
    
    found = [b for b in data if (b.get('viewing_insight_executor') or '').strip() or (b.get('viewing_insight_companion') or '').strip()]
    print(f"気づきあり: {len(found)}件")
    for b in found:
        print(f"  {b['buyer_number']}: {repr(b.get('viewing_insight_executor', '')[:30])}")

# 4998を直接確認
print("\n--- 4998直接確認 ---")
url2 = f"{SUPABASE_URL}/rest/v1/buyers?buyer_number=eq.4998&select=buyer_number,viewing_insight_executor,viewing_insight_companion"
req2 = urllib.request.Request(url2, headers=headers)
with urllib.request.urlopen(req2) as res:
    data2 = json.loads(res.read())
    print(data2)

# .or フィルタを使ったクエリ（バックエンドと同じ）
print("\n--- .or フィルタ確認 ---")
url3 = f"{SUPABASE_URL}/rest/v1/buyers?select=buyer_number,viewing_insight_executor,viewing_insight_companion&deleted_at=is.null&or=(viewing_insight_executor.neq.,viewing_insight_companion.neq.)"
req3 = urllib.request.Request(url3, headers=headers)
with urllib.request.urlopen(req3) as res:
    data3 = json.loads(res.read())
    print(f"orフィルタ結果: {len(data3)}件")
    print(data3)
