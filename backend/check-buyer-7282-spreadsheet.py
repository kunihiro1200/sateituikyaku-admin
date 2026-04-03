#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
買主7282のスプレッドシートデータを確認
"""

import os
import sys
from google.oauth2 import service_account
from googleapiclient.discovery import build

# サービスアカウントキーのパス
KEY_PATH = os.path.join(os.path.dirname(__file__), 'service-account-key.json')

# スプレッドシートID（買主リスト）
SPREADSHEET_ID = '1tI_iXaiLuWBggs5y0RH7qzkbHs9wnLLdRekAmjkhcLY'

# 認証
credentials = service_account.Credentials.from_service_account_file(
    KEY_PATH,
    scopes=['https://www.googleapis.com/auth/spreadsheets.readonly']
)

service = build('sheets', 'v4', credentials=credentials)

# スプレッドシートからデータを取得
sheet = service.spreadsheets()
result = sheet.values().get(
    spreadsheetId=SPREADSHEET_ID,
    range='買主リスト!B:CZ'  # B列から全データ取得
).execute()

values = result.get('values', [])

if not values:
    print('❌ データが見つかりません')
    sys.exit(1)

# ヘッダー行
headers = values[0]

# 買主番号のインデックスを探す
buyer_number_idx = None
for i, header in enumerate(headers):
    if '買主番号' in str(header):
        buyer_number_idx = i
        break

if buyer_number_idx is None:
    print('❌ 買主番号カラムが見つかりません')
    sys.exit(1)

# 買主7282を探す
target_buyer = None
target_row_idx = None

for i, row in enumerate(values[1:], start=2):  # ヘッダーをスキップ
    if len(row) > buyer_number_idx:
        buyer_number = str(row[buyer_number_idx]).strip()
        if buyer_number == '7282':
            target_buyer = row
            target_row_idx = i
            break

if not target_buyer:
    print('❌ 買主7282が見つかりません')
    sys.exit(1)

print(f'✅ 買主7282が見つかりました（行{target_row_idx}）\n')

# 重要なフィールドを表示
important_fields = [
    '買主番号',
    '内覧日（最新）',
    '時間',
    '内覧形態',
    '最新内覧日',
    '内覧後売主連絡',
    '内覧促進メール'
]

print('📊 スプレッドシートのデータ:')
print('=' * 60)

for field in important_fields:
    try:
        field_idx = headers.index(field)
        value = target_buyer[field_idx] if len(target_buyer) > field_idx else ''
        print(f'{field}: {value}')
    except ValueError:
        print(f'{field}: （カラムが見つかりません）')
    except IndexError:
        print(f'{field}: （データなし）')

print('=' * 60)
