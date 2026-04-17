#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
スプレッドシートから買主7605のデータを直接確認するスクリプト
"""
import os
import json
from google.oauth2 import service_account
from googleapiclient.discovery import build
from dotenv import load_dotenv

load_dotenv('backend/.env')

SPREADSHEET_ID = '1tI_iXaiLuWBggs5y0RH7qzkbHs9wnLLdRekAmjkhcLY'
SHEET_NAME = '買主リスト'
SERVICE_ACCOUNT_FILE = 'backend/google-service-account.json'

# Google Sheets APIの認証
credentials = service_account.Credentials.from_service_account_file(
    SERVICE_ACCOUNT_FILE,
    scopes=['https://www.googleapis.com/auth/spreadsheets.readonly']
)
service = build('sheets', 'v4', credentials=credentials)

print("=== スプレッドシートのヘッダー確認 ===\n")

# ヘッダー取得
header_result = service.spreadsheets().values().get(
    spreadsheetId=SPREADSHEET_ID,
    range=f"'{SHEET_NAME}'!1:1"
).execute()
headers = header_result.get('values', [[]])[0]
print(f"総カラム数: {len(headers)}")

# E列（index 4）の確認
if len(headers) > 4:
    print(f"E列（index 4）のヘッダー: '{headers[4]}'")
else:
    print("E列が存在しません")

# 買主番号カラムのインデックスを探す
buyer_number_index = None
for i, h in enumerate(headers):
    if h == '買主番号':
        buyer_number_index = i
        print(f"'買主番号'カラムのインデックス: {i} (列: {chr(65 + i) if i < 26 else '複数文字'})")
        break

if buyer_number_index is None:
    print("'買主番号'カラムが見つかりません！")
    print("ヘッダー一覧（最初の10個）:")
    for i, h in enumerate(headers[:10]):
        print(f"  [{i}] '{h}'")

print("\n=== スプレッドシートから7605を検索 ===\n")

# データ取得（E列のみ）
data_result = service.spreadsheets().values().get(
    spreadsheetId=SPREADSHEET_ID,
    range=f"'{SHEET_NAME}'!A:GZ",
    valueRenderOption='UNFORMATTED_VALUE'
).execute()
rows = data_result.get('values', [])
print(f"総行数（ヘッダー含む）: {len(rows)}")

# 7605を検索
found_rows = []
if buyer_number_index is not None:
    for i, row in enumerate(rows[1:], start=2):  # ヘッダーをスキップ
        if len(row) > buyer_number_index:
            val = str(row[buyer_number_index]).strip()
            if val == '7605':
                found_rows.append((i, row))

if found_rows:
    print(f"✅ 7605が見つかりました（{len(found_rows)}行）")
    for row_num, row in found_rows:
        print(f"\n  行番号: {row_num}")
        print(f"  買主番号: {row[buyer_number_index] if len(row) > buyer_number_index else 'N/A'}")
        if len(headers) > 6 and len(row) > 6:
            print(f"  受付日（F列）: {row[5] if len(row) > 5 else 'N/A'}")
            print(f"  氏名（G列）: {row[6] if len(row) > 6 else 'N/A'}")
        print(f"  行データ（最初の10列）: {row[:10]}")
else:
    print(f"❌ 7605が見つかりません")
    
    # 近隣の番号を確認
    print("\n近隣の番号（7600-7610）を検索:")
    for i, row in enumerate(rows[1:], start=2):
        if len(row) > buyer_number_index:
            val = str(row[buyer_number_index]).strip()
            try:
                num = int(float(val))
                if 7600 <= num <= 7610:
                    print(f"  行{i}: buyer_number={val} (int={num}), 氏名={row[6] if len(row) > 6 else 'N/A'}")
            except (ValueError, TypeError):
                pass

print("\n=== 最大buyer_numberの確認 ===\n")

# 最大の買主番号を確認
max_num = 0
max_row = None
if buyer_number_index is not None:
    for i, row in enumerate(rows[1:], start=2):
        if len(row) > buyer_number_index:
            val = str(row[buyer_number_index]).strip()
            try:
                num = int(float(val))
                if num > max_num:
                    max_num = num
                    max_row = (i, row)
            except (ValueError, TypeError):
                pass

print(f"スプレッドシートの最大buyer_number: {max_num}")
if max_row:
    print(f"  行番号: {max_row[0]}")
    print(f"  氏名: {max_row[1][6] if len(max_row[1]) > 6 else 'N/A'}")

print("\n=== 7600以上の買主番号一覧 ===\n")

if buyer_number_index is not None:
    high_numbers = []
    for i, row in enumerate(rows[1:], start=2):
        if len(row) > buyer_number_index:
            val = str(row[buyer_number_index]).strip()
            try:
                num = int(float(val))
                if num >= 7600:
                    high_numbers.append((i, num, row[6] if len(row) > 6 else 'N/A'))
            except (ValueError, TypeError):
                pass
    
    high_numbers.sort(key=lambda x: x[1])
    print(f"7600以上の買主番号: {len(high_numbers)}件")
    for row_num, num, name in high_numbers:
        print(f"  行{row_num}: {num} - {name}")
