"""
seller_phone バックフィルスクリプト
property_listings.seller_phone を sellers テーブルから一括補完

実行方法:
  cd backend
  pip install supabase cryptography python-dotenv
  python backfill_seller_phone.py
"""

import base64
import os
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv('.env')

SUPABASE_URL = os.environ['SUPABASE_URL']
SUPABASE_SERVICE_KEY = os.environ['SUPABASE_SERVICE_KEY']
ENCRYPTION_KEY = os.environ['ENCRYPTION_KEY']

IV_LENGTH = 16
SALT_LENGTH = 64
TAG_LENGTH = 16

def decrypt(encrypted_text: str) -> str:
    """AES-256-GCM復号 (iv=16, salt=64, tag=16, data=rest)"""
    key = ENCRYPTION_KEY[:32].encode('utf-8')
    buf = base64.b64decode(encrypted_text)
    min_len = IV_LENGTH + SALT_LENGTH + TAG_LENGTH
    if len(buf) < min_len:
        return encrypted_text
    iv = buf[:IV_LENGTH]
    tag = buf[IV_LENGTH + SALT_LENGTH: IV_LENGTH + SALT_LENGTH + TAG_LENGTH]
    ciphertext = buf[IV_LENGTH + SALT_LENGTH + TAG_LENGTH:]
    aesgcm = AESGCM(key)
    decrypted = aesgcm.decrypt(iv, ciphertext + tag, None)
    return decrypted.decode('utf-8')

def main():
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    print('seller_phone バックフィル開始...')

    # seller_phone が NULL の物件を全件取得（ページング対応）
    listings = []
    offset = 0
    PAGE = 1000
    while True:
        res = supabase.table('property_listings') \
            .select('property_number') \
            .is_('seller_phone', 'null') \
            .range(offset, offset + PAGE - 1) \
            .execute()
        batch = res.data or []
        listings.extend(batch)
        if len(batch) < PAGE:
            break
        offset += PAGE

    if not listings:
        print('seller_phone が NULL の物件はありません')
        return

    print(f'対象物件数: {len(listings)}')

    # sellers テーブルから property_number, phone_number を全件取得
    # 結合キー: sellers.property_number = property_listings.property_number
    print('sellers テーブルから電話番号を全件取得中...')
    phone_map = {}
    offset = 0
    while True:
        res = supabase.table('sellers') \
            .select('property_number,phone_number') \
            .range(offset, offset + PAGE - 1) \
            .execute()
        batch = res.data or []
        for s in batch:
            pn2 = s.get('property_number')
            ph = s.get('phone_number')
            if pn2 and ph:
                try:
                    phone_map[pn2] = decrypt(ph)
                except Exception:
                    pass
        if len(batch) < PAGE:
            break
        offset += PAGE
        print(f'  取得済み: {offset}件...')

    print(f'電話番号取得済み売主数: {len(phone_map)}')

    # バッチ更新（property_number をキーに phone_map から電話番号を取得）
    updated = 0
    skipped = 0
    for listing in listings:
        pn = listing.get('property_number')
        phone = phone_map.get(pn) if pn else None
        if not phone:
            skipped += 1
            continue
        try:
            supabase.table('property_listings') \
                .update({'seller_phone': phone}) \
                .eq('property_number', pn) \
                .execute()
            updated += 1
        except Exception as e:
            print(f'更新エラー {pn}: {e}')

    print(f'完了: {updated}件更新, {skipped}件スキップ（売主データなし）')

if __name__ == '__main__':
    main()
