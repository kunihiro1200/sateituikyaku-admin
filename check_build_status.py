import urllib.request
import json
import os

# Vercel APIでデプロイ状況を確認
# project IDはbackend/.vercel/project.jsonから
PROJECT_ID = "prj_Ar6ExsktF0Z6g3Jgmx02IhTgGwSh"

# VERCEL_TOKENが必要 - まずローカルでAPIを直接テスト
SUPABASE_URL = "https://krxhrbtlgfjzsseegaqq.supabase.co"
SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyeGhyYnRsZ2ZqenNzZWVnYXFxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzAyMTQxMSwiZXhwIjoyMDc4NTk3NDExfQ.nog3UX9J9OgfqlCIPJt_sU_exE6Ny-nSj_HmwgV3oA8"

headers = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
}

# 4998の気づきデータを再確認
url = f"{SUPABASE_URL}/rest/v1/buyers?buyer_number=eq.4998&select=buyer_number,viewing_insight_executor,viewing_insight_companion,deleted_at"
req = urllib.request.Request(url, headers=headers)
with urllib.request.urlopen(req) as res:
    data = json.loads(res.read())
    print("=== 4998の気づきデータ ===")
    for row in data:
        print(f"  executor: {repr(row.get('viewing_insight_executor'))}")
        print(f"  companion: {repr(row.get('viewing_insight_companion'))}")
        print(f"  deleted_at: {row.get('deleted_at')}")

# 気づきが入力されている全買主（直接DBで確認）
url2 = f"{SUPABASE_URL}/rest/v1/buyers?select=buyer_number,viewing_insight_executor,viewing_insight_companion&deleted_at=is.null&limit=1000"
req2 = urllib.request.Request(url2, headers=headers)
with urllib.request.urlopen(req2) as res:
    data2 = json.loads(res.read())
    found = [b for b in data2 if (b.get('viewing_insight_executor') or '').strip() or (b.get('viewing_insight_companion') or '').strip()]
    print(f"\n=== 気づきが入力されている買主: {len(found)}件 ===")
    for b in found:
        print(f"  {b['buyer_number']}: executor={repr((b.get('viewing_insight_executor') or '')[:20])}")
