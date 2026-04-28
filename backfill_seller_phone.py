"""
property_listings テーブルの seller_phone が NULL の物件に
sellers テーブルから電話番号を復号して補完するスクリプト
"""
import requests
import json
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import base64
import os

SUPABASE_URL = "https://krxhrbtlgfjzsseegaqq.supabase.co"
SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyeGhyYnRsZ2ZqenNzZWVnYXFxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzAyMTQxMSwiZXhwIjoyMDc4NTk3NDExfQ.nog3UX9J9OgfqlCIPJt_sU_exE6Ny-nSj_HmwgV3oA8"
ENCRYPTION_KEY = "1rJEtoCusAIMzyR86P6TQr0ND600D/dU"

HEADERS = {
    "apikey": SUPABASE_SERVICE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
    "Content-Type": "application/json",
}

def decrypt(encrypted_text: str) -> str:
    """AES-256-GCM で暗号化されたテキストを復号する
    構造: IV(16) + SALT(64) + TAG(16) + 暗号文
    """
    key = ENCRYPTION_KEY.encode("utf-8")
    if len(key) != 32:
        raise ValueError(f"ENCRYPTION_KEY must be 32 bytes, got {len(key)}")
    
    data = base64.b64decode(encrypted_text)
    
    IV_LENGTH = 16
    SALT_LENGTH = 64
    TAG_LENGTH = 16
    MIN_LENGTH = IV_LENGTH + SALT_LENGTH + TAG_LENGTH
    
    if len(data) < MIN_LENGTH:
        # 平文として扱う
        return encrypted_text
    
    iv = data[:IV_LENGTH]
    # salt は使用しない（将来の拡張用）
    tag = data[IV_LENGTH + SALT_LENGTH : IV_LENGTH + SALT_LENGTH + TAG_LENGTH]
    ciphertext = data[IV_LENGTH + SALT_LENGTH + TAG_LENGTH:]
    
    # AES-256-GCM 復号: ciphertext + tag を結合してAESGCMに渡す
    aesgcm = AESGCM(key)
    plaintext = aesgcm.decrypt(iv, ciphertext + tag, None)
    return plaintext.decode("utf-8")

def fetch_all(url, params=None):
    """Supabase REST APIから全件取得（ページネーション対応）"""
    results = []
    offset = 0
    limit = 1000
    while True:
        p = dict(params or {})
        p["limit"] = limit
        p["offset"] = offset
        r = requests.get(url, headers={**HEADERS, "Range": f"{offset}-{offset+limit-1}", "Prefer": "count=exact"}, params=p)
        r.raise_for_status()
        batch = r.json()
        if not batch:
            break
        results.extend(batch)
        if len(batch) < limit:
            break
        offset += limit
    return results

def main():
    print("=== seller_phone バックフィル開始 ===")
    
    # seller_phone が NULL の物件を全件取得（ページネーション対応）
    print("seller_phone が NULL の物件を取得中...")
    listings = []
    offset = 0
    limit = 1000
    while True:
        r = requests.get(
            f"{SUPABASE_URL}/rest/v1/property_listings",
            headers=HEADERS,
            params={
                "select": "property_number",
                "seller_phone": "is.null",
                "limit": limit,
                "offset": offset,
            }
        )
        r.raise_for_status()
        batch = r.json()
        if not batch:
            break
        listings.extend(batch)
        print(f"  取得中: {len(listings)} 件...")
        if len(batch) < limit:
            break
        offset += limit
    print(f"  → 合計 {len(listings)} 件の物件が seller_phone = NULL")
    
    if not listings:
        print("補完が必要な物件はありません。")
        return
    
    property_numbers = [l["property_number"] for l in listings if l.get("property_number")]
    print(f"  → 対象物件番号: {len(property_numbers)} 件")
    
    # sellers テーブルから電話番号を取得（バッチで）
    print("sellers テーブルから電話番号を取得中...")
    phone_map = {}
    batch_size = 100
    for i in range(0, len(property_numbers), batch_size):
        batch = property_numbers[i:i+batch_size]
        in_filter = "(" + ",".join(batch) + ")"
        r = requests.get(
            f"{SUPABASE_URL}/rest/v1/sellers",
            headers=HEADERS,
            params={
                "select": "seller_number,phone_number",
                "seller_number": f"in.{in_filter}",
                "limit": batch_size,
            }
        )
        r.raise_for_status()
        sellers = r.json()
        for s in sellers:
            if s.get("phone_number"):
                try:
                    phone_map[s["seller_number"]] = decrypt(s["phone_number"])
                except Exception as e:
                    print(f"  ⚠️ 復号失敗 seller_number={s['seller_number']}: {e}")
    
    print(f"  → 電話番号が取得できた売主: {len(phone_map)} 件")
    
    # property_listings を更新
    updated = 0
    skipped = 0
    for listing in listings:
        pn = listing.get("property_number")
        if not pn or pn not in phone_map:
            skipped += 1
            continue
        
        phone = phone_map[pn]
        r = requests.patch(
            f"{SUPABASE_URL}/rest/v1/property_listings",
            headers={**HEADERS, "Prefer": "return=minimal"},
            params={"property_number": f"eq.{pn}"},
            json={"seller_phone": phone}
        )
        if r.status_code in (200, 204):
            updated += 1
        else:
            print(f"  ❌ 更新失敗 property_number={pn}: {r.status_code} {r.text}")
    
    print(f"\n=== 完了 ===")
    print(f"  更新: {updated} 件")
    print(f"  スキップ（売主なし）: {skipped} 件")

if __name__ == "__main__":
    main()
