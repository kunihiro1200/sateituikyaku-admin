import urllib.request
import json
import ssl

SUPABASE_URL = "https://krxhrbtlgfjzsseegaqq.supabase.co"
SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyeGhyYnRsZ2ZqenNzZWVnYXFxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzAyMTQxMSwiZXhwIjoyMDc4NTk3NDExfQ.nog3UX9J9OgfqlCIPJt_sU_exE6Ny-nSj_HmwgV3oA8"

# SSL context
ctx = ssl.create_default_context()

def run_sql(sql, description):
    url = f"{SUPABASE_URL}/rest/v1/rpc/exec_sql"
    headers = {
        "apikey": SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
        "Content-Type": "application/json",
    }
    data = json.dumps({"query": sql}).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, context=ctx) as resp:
            result = resp.read().decode("utf-8")
            print(f"OK: {description}")
            if result:
                print(f"  Result: {result[:200]}")
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8")
        print(f"ERROR ({e.code}): {description}")
        print(f"  {error_body[:300]}")
        return False
    return True

# Supabase doesn't have exec_sql by default, use the SQL endpoint instead
# Try using the pg REST endpoint with raw SQL via the management API
# Alternative: use supabase-py or direct postgres connection

# Let's try using the Supabase Management API (requires different auth)
# Actually, let's use the PostgREST RPC approach - we need a function

# First, let's try a simpler approach: use supabase client to update records
# via the REST API (select + update)

def update_via_rest():
    """Update activities via Supabase REST API"""
    
    # First, get all email activities with 'メール送信:' prefix
    url = f"{SUPABASE_URL}/rest/v1/activities?type=eq.email&content=like.メール送信:*&select=id,content,metadata&limit=500"
    headers = {
        "apikey": SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
        "Content-Type": "application/json",
    }
    
    req = urllib.request.Request(url, headers=headers, method="GET")
    try:
        with urllib.request.urlopen(req, context=ctx) as resp:
            activities = json.loads(resp.read().decode("utf-8"))
            print(f"Found {len(activities)} email activities with 'メール送信:' prefix")
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8")
        print(f"ERROR fetching activities: {e.code} - {error_body[:300]}")
        return
    
    # Determine template name for each activity
    updated = 0
    for activity in activities:
        content = activity.get("content", "")
        metadata = activity.get("metadata", {}) or {}
        body = metadata.get("body", "") or ""
        subject = metadata.get("subject", "") or ""
        activity_id = activity.get("id")
        
        template_name = None
        
        # Match by subject pattern
        if "机上査定のご案内" in content:
            if "相続登記の義務化" in body:
                template_name = "査定額案内メール(相続)"
            else:
                template_name = "査定額案内メール(相続以外)"
        elif "【イエウール】査定依頼の件" in content:
            if "電話時間" in body or "お電話" in body:
                template_name = "不通で電話時間確認＆キャンセル案内（イエウール）"
            else:
                template_name = "キャンセル案内のみ（イエウール）"
        elif "【LIFULL/Yahoo】査定依頼の件" in content:
            if "電話時間" in body or "お電話" in body:
                template_name = "不通で電話時間確認＆キャンセル案内（LIFULL/Yahoo）"
            else:
                template_name = "キャンセル案内のみ（LIFULL/Yahoo）"
        elif "【すまいステップ】査定依頼の件" in content:
            if "電話時間" in body or "お電話" in body:
                template_name = "不通で電話時間確認＆キャンセル案内（すまいステップ）"
            else:
                template_name = "キャンセル案内のみ（すまいステップ）"
        elif "【HOME4U】査定依頼の件" in content:
            if "電話時間" in body or "お電話" in body:
                template_name = "不通で電話時間確認＆キャンセル案内（HOME4U）"
            else:
                template_name = "キャンセル案内のみ（HOME4U）"
        elif "売却までの流れのご説明" in content:
            template_name = "WEB打合せどうですかメール"
        elif "御礼" in content and "いふう" in content:
            template_name = "訪問査定後御礼メール"
        elif "の査定の件" in content and "机上査定" not in content:
            template_name = "空"
        elif "明日の訪問査定のご確認" in content:
            template_name = "訪問前日通知メール"
        elif "その後のご状況確認" in content:
            if "3ヶ月" in body:
                template_name = "他決→追客（3ヶ月目）"
            elif "6ヶ月" in body:
                template_name = "他決→追客（6ヶ月目）"
        elif "住み替え先のご相談" in content:
            template_name = "（査定理由別）住替え先（３日後メール）"
        elif "相続に関するご相談" in content:
            template_name = "（査定理由別）相続（３日後メール）"
        elif "不動産売却のご相談" in content:
            template_name = "（査定理由別）離婚（３日後メール）"
        elif "住宅ローンのご相談" in content:
            template_name = "（査定理由別）ローン厳しい（３日後メール）"
        elif "購入希望のお客様がいらっしゃいます" in content:
            template_name = "除外前、長期客（お客様いるメール）"
        elif "お電話させていただきました" in content:
            template_name = "リマインド"
        elif "相続登記のご案内" in content:
            template_name = "相続登記（きざし様へご案内）"
        elif "ご意見をお聞かせください" in content:
            template_name = "他決になった理由お伺いメール"
        elif "お問合せの件" in content:
            template_name = "不通で電話時間確認＆キャンセル案内"
        
        if template_name and activity_id:
            # Update the activity
            new_content = f"【{template_name}】を送信"
            new_metadata = dict(metadata)
            new_metadata["templateName"] = template_name
            
            update_url = f"{SUPABASE_URL}/rest/v1/activities?id=eq.{activity_id}"
            update_data = json.dumps({
                "content": new_content,
                "metadata": new_metadata,
            }).encode("utf-8")
            update_headers = {
                "apikey": SERVICE_KEY,
                "Authorization": f"Bearer {SERVICE_KEY}",
                "Content-Type": "application/json",
                "Prefer": "return=minimal",
            }
            update_req = urllib.request.Request(update_url, data=update_data, headers=update_headers, method="PATCH")
            try:
                with urllib.request.urlopen(update_req, context=ctx) as resp:
                    updated += 1
            except urllib.error.HTTPError as e:
                error_body = e.read().decode("utf-8")
                print(f"  ERROR updating {activity_id}: {e.code} - {error_body[:200]}")
    
    print(f"\nDone! Updated {updated}/{len(activities)} activities")

update_via_rest()
