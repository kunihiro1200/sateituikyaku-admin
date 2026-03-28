"""
暗号化済み address データのバックフィル修正スクリプト（Python版）

対象: sellers テーブルの address カラムが暗号化文字列になっているレコード
処理: decrypt() で復号して平文に更新する

実行方法:
  python backend/backfill_decrypt_seller_address.py

ドライランモード:
  DRY_RUN=true python backend/backfill_decrypt_seller_address.py
"""

import os
import sys
import base64
import hashlib
import struct
from pathlib import Path

# .env.local を読み込む（既存の環境変数を上書き）
env_path = Path(__file__).parent / '.env.local'
if env_path.exists():
    with open(env_path, encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, _, value = line.partition('=')
                value = value.strip()
                if (value.startswith('"') and value.endswith('"')) or (value.startswith("'") and value.endswith("'")):
                    value = value[1:-1]
                os.environ[key.strip()] = value

SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_KEY = (
    os.environ.get('SUPABASE_SERVICE_KEY') or
    os.environ.get('SUPABASE_SERVICE_ROLE_KEY') or
    os.environ.get('SUPABASE_ANON_KEY', '')
)
ENCRYPTION_KEY = os.environ.get('ENCRYPTION_KEY', '')
DRY_RUN = os.environ.get('DRY_RUN', '').lower() == 'true'

if not SUPABASE_URL or not SUPABASE_KEY:
    print('❌ SUPABASE_URL または SUPABASE_SERVICE_KEY が設定されていません')
    sys.exit(1)

if not ENCRYPTION_KEY:
    print('❌ ENCRYPTION_KEY が設定されていません')
    sys.exit(1)

if len(ENCRYPTION_KEY) != 32:
    print(f'❌ ENCRYPTION_KEY は32文字である必要があります（現在: {len(ENCRYPTION_KEY)}文字）')
    sys.exit(1)

try:
    import urllib.request
    import urllib.error
    import json
except ImportError:
    print('❌ 標準ライブラリが利用できません')
    sys.exit(1)

try:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    HAS_CRYPTOGRAPHY = True
except ImportError:
    HAS_CRYPTOGRAPHY = False
    print('cryptography ライブラリが見つかりません。pip install cryptography を実行してください')
    sys.exit(1)


def is_encrypted_value(value: str) -> bool:
    """暗号文かどうかを判定（Base64デコード後のバイト長が96以上）"""
    if not value or len(value) < 128:
        return False
    try:
        buf = base64.b64decode(value)
        return len(buf) >= 96
    except Exception:
        return False


def decrypt(encrypted_data: str) -> str:
    """AES-256-GCM で復号する（Node.js encryption.ts と同じフォーマット）
    フォーマット: iv(16) + salt(64, 未使用) + tag(16) + encrypted(rest)
    キーは直接使用（scryptなし）
    """
    key = ENCRYPTION_KEY.encode('utf-8')  # 32バイトのキーをそのまま使用
    combined = base64.b64decode(encrypted_data)

    IV_LENGTH = 16
    SALT_LENGTH = 64
    TAG_LENGTH = 16

    iv = combined[:IV_LENGTH]
    # salt = combined[IV_LENGTH:IV_LENGTH + SALT_LENGTH]  # 未使用
    tag = combined[IV_LENGTH + SALT_LENGTH:IV_LENGTH + SALT_LENGTH + TAG_LENGTH]
    encrypted = combined[IV_LENGTH + SALT_LENGTH + TAG_LENGTH:]

    aesgcm = AESGCM(key)
    # AESGCM.decrypt は nonce, data(ciphertext+tag), aad を受け取る
    # cryptography ライブラリでは tag は ciphertext の末尾に結合する
    decrypted = aesgcm.decrypt(iv, encrypted + tag, None)
    return decrypted.decode('utf-8')


def supabase_request(method: str, path: str, body=None):
    """Supabase REST API リクエスト"""
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    headers = {
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
        'Content-Type': 'application/json',
    }
    if method in ('POST', 'PATCH', 'PUT'):
        headers['Prefer'] = 'return=minimal'
    data = json.dumps(body).encode('utf-8') if body else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            content = resp.read()
            if content:
                return json.loads(content)
            return []
    except urllib.error.HTTPError as e:
        error_body = e.read().decode('utf-8')
        raise Exception(f'HTTP {e.code}: {error_body}')


def main():
    print('=== 暗号化済み address データのバックフィル修正スクリプト ===')
    print(f'モード: {"ドライラン（更新しない）" if DRY_RUN else "本番実行"}')
    print()

    # 全売主の id, seller_number, address を取得（ページネーション対応）
    all_sellers = []
    offset = 0
    page_size = 1000

    while True:
        path = f'sellers?select=id,seller_number,address&deleted_at=is.null&limit={page_size}&offset={offset}'
        data = supabase_request('GET', path)
        if not data:
            break
        all_sellers.extend(data)
        if len(data) < page_size:
            break
        offset += page_size

    print(f'取得した売主数: {len(all_sellers)}')

    # 暗号化済み address を持つ売主を抽出
    encrypted_sellers = [
        s for s in all_sellers
        if s.get('address') and is_encrypted_value(s['address'])
    ]

    print(f'暗号化済み address を持つ売主数: {len(encrypted_sellers)}')

    if not encrypted_sellers:
        print('修正が必要な売主はいません')
        return

    print()
    print('対象売主:')
    for s in encrypted_sellers:
        print(f'  - {s["seller_number"]} (id: {s["id"]})')
    print()

    if DRY_RUN:
        print('ドライランモード: 実際には更新しません')
        return

    # 復号してリストを作成
    updates = []
    for s in encrypted_sellers:
        try:
            decrypted_address = decrypt(s['address'])
            updates.append({'id': s['id'], 'seller_number': s['seller_number'], 'address': decrypted_address})
        except Exception as e:
            print(f'NG {s["seller_number"]}: 復号エラー - {e}')

    print(f'復号完了: {len(updates)} 件')
    print('DB更新中...')

    # 並列更新（ThreadPoolExecutor で高速化）
    import concurrent.futures

    success_count = 0
    error_count = 0

    def update_one(item):
        path = f'sellers?id=eq.{item["id"]}'
        supabase_request('PATCH', path, {'address': item['address']})
        return item['seller_number']

    with concurrent.futures.ThreadPoolExecutor(max_workers=20) as executor:
        futures = {executor.submit(update_one, item): item for item in updates}
        for i, future in enumerate(concurrent.futures.as_completed(futures), 1):
            item = futures[future]
            try:
                seller_number = future.result()
                success_count += 1
                if i % 100 == 0 or i == len(updates):
                    print(f'  進捗: {i}/{len(updates)} 件完了')
            except Exception as e:
                print(f'NG {item["seller_number"]}: 更新エラー - {e}')
                error_count += 1

    print()
    print(f'結果: 成功 {success_count} 件 / エラー {error_count} 件')

    if success_count > 0:
        print()
        print('DBの address が平文に修正されました。')
        print('次回の DB->スプシ同期時に自動的にスプレッドシートにも反映されます。')


if __name__ == '__main__':
    main()
