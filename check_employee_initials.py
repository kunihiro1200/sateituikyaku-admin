import urllib.request
import json

SUPABASE_URL = "https://krxhrbtlgfjzsseegaqq.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyeGhyYnRsZ2ZqenNzZWVnYXFxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzAyMTQxMSwiZXhwIjoyMDc4NTk3NDExfQ.nog3UX9J9OgfqlCIPJt_sU_exE6Ny-nSj_HmwgV3oA8"

# 全従業員のイニシャルとメールを確認
url = f"{SUPABASE_URL}/rest/v1/employees?select=id,name,initials,email&is_active=eq.true"
req = urllib.request.Request(url, headers={
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
})
with urllib.request.urlopen(req) as res:
    data = json.loads(res.read())
    print("=== 従業員一覧（アクティブ） ===")
    for row in data:
        print(f"  name: {row.get('name')}, initials: '{row.get('initials')}', email: '{row.get('email')}'")

print("\n=== '国広' で検索 ===")
url2 = f"{SUPABASE_URL}/rest/v1/employees?select=id,name,initials,email&initials=eq.国広"
req2 = urllib.request.Request(url2, headers={
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
})
with urllib.request.urlopen(req2) as res2:
    data2 = json.loads(res2.read())
    if data2:
        for row in data2:
            print(f"  見つかった: name={row.get('name')}, email={row.get('email')}")
    else:
        print("  見つからない（イニシャルが一致しない）")
