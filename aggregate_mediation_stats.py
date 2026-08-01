#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
売主リストスプレッドシートから月別の媒介獲得数を集計するスクリプト

集計条件:
- K列（サイト）に「す」が入っている
- AA列（訪問）に値がある（訪問済み）
- AC列（状況（自社））が「一般媒介」or「専任媒介」

月の判定はAA列（訪問日）を基準とする
"""

import os
import json
from datetime import datetime
from collections import defaultdict
from google.oauth2 import service_account
from googleapiclient.discovery import build
from dotenv import load_dotenv

load_dotenv('backend/.env')

# 対象スプレッドシート
SPREADSHEET_ID = '1wKBRLWbT6pSKa9IlTDabjhjTnfs_GxX6Rn6M6kbio1I'
SHEET_GID = '2046973831'  # 売主リストシート

SERVICE_ACCOUNT_FILE = 'backend/google-service-account.json'

# Google Sheets APIの認証
credentials = service_account.Credentials.from_service_account_file(
    SERVICE_ACCOUNT_FILE,
    scopes=['https://www.googleapis.com/auth/spreadsheets.readonly']
)
service = build('sheets', 'v4', credentials=credentials)


def get_sheet_name_by_gid(spreadsheet_id, target_gid):
    """GIDからシート名を取得"""
    spreadsheet = service.spreadsheets().get(spreadsheetId=spreadsheet_id).execute()
    for sheet in spreadsheet['sheets']:
        if sheet['properties']['sheetId'] == int(target_gid):
            return sheet['properties']['title']
    return None


def col_letter_to_index(letter):
    """列文字をインデックスに変換 (A=0, B=1, ..., AA=26, ...)"""
    result = 0
    for char in letter.upper():
        result = result * 26 + (ord(char) - ord('A') + 1)
    return result - 1


def parse_date(value):
    """日付文字列をdatetimeに変換"""
    if not value:
        return None
    value = str(value).strip()
    # いろいろな日付フォーマットに対応
    formats = [
        '%Y-%m-%d %H:%M:%S',
        '%Y-%m-%d %H:%M',
        '%Y-%m-%d',
        '%Y/%m/%d %H:%M:%S',
        '%Y/%m/%d %H:%M',
        '%Y/%m/%d',
    ]
    for fmt in formats:
        try:
            return datetime.strptime(value, fmt)
        except ValueError:
            continue
    return None


def main():
    print("=" * 70)
    print("売主リスト 媒介獲得数 月別集計")
    print("=" * 70)
    print()

    # シート名を取得
    sheet_name = get_sheet_name_by_gid(SPREADSHEET_ID, SHEET_GID)
    if not sheet_name:
        print(f"❌ GID {SHEET_GID} のシートが見つかりません")
        return
    print(f"シート名: {sheet_name}")

    # ヘッダー取得
    header_result = service.spreadsheets().values().get(
        spreadsheetId=SPREADSHEET_ID,
        range=f"'{sheet_name}'!1:1"
    ).execute()
    headers = header_result.get('values', [[]])[0]
    print(f"カラム数: {len(headers)}")

    # カラムインデックスの確認
    # K列 = index 10, AA列 = index 26, AC列 = index 28
    K_INDEX = 10   # K列（サイト）
    AA_INDEX = 26  # AA列（訪問）
    AC_INDEX = 28  # AC列（状況（自社））

    print(f"\n確認:")
    print(f"  K列 (index {K_INDEX}): {headers[K_INDEX] if len(headers) > K_INDEX else '存在しない'}")
    print(f"  AA列 (index {AA_INDEX}): {headers[AA_INDEX] if len(headers) > AA_INDEX else '存在しない'}")
    print(f"  AC列 (index {AC_INDEX}): {headers[AC_INDEX] if len(headers) > AC_INDEX else '存在しない'}")

    # ヘッダーを表示して確認
    print(f"\n  参考: 周辺カラム")
    for i in range(max(0, K_INDEX - 1), min(len(headers), K_INDEX + 2)):
        print(f"    [{i}] {headers[i]}")
    print()
    for i in range(max(0, AA_INDEX - 1), min(len(headers), AC_INDEX + 2)):
        print(f"    [{i}] {headers[i]}")

    # 全データ取得
    print(f"\nデータ取得中...")
    data_result = service.spreadsheets().values().get(
        spreadsheetId=SPREADSHEET_ID,
        range=f"'{sheet_name}'!A:BZ"
    ).execute()
    rows = data_result.get('values', [])
    print(f"総行数（ヘッダー含む）: {len(rows)}")

    # 集計
    # month_key -> {'一般媒介': count, '専任媒介': count}
    monthly_stats = defaultdict(lambda: {'一般媒介': 0, '専任媒介': 0})
    total_stats = {'一般媒介': 0, '専任媒介': 0}
    matched_rows = []

    for i, row in enumerate(rows[1:], start=2):  # ヘッダーをスキップ
        # K列の値を取得
        k_val = row[K_INDEX].strip() if len(row) > K_INDEX else ''
        # AA列の値を取得
        aa_val = row[AA_INDEX].strip() if len(row) > AA_INDEX else ''
        # AC列の値を取得
        ac_val = row[AC_INDEX].strip() if len(row) > AC_INDEX else ''

        # 条件チェック
        # K列に「す」がある
        if k_val != 'す':
            continue
        # AA列に値がある（訪問済み）
        if not aa_val:
            continue
        # AC列が「一般媒介」or「専任媒介」
        if ac_val not in ('一般媒介', '専任媒介'):
            continue

        # 月の判定: AA列の日付を使う
        visit_date = parse_date(aa_val)
        if visit_date:
            month_key = visit_date.strftime('%Y年%m月')
        else:
            month_key = '日付不明'

        monthly_stats[month_key][ac_val] += 1
        total_stats[ac_val] += 1
        matched_rows.append({
            'row': i,
            'k': k_val,
            'aa': aa_val,
            'ac': ac_val,
            'month': month_key
        })

    # 結果表示
    print(f"\n{'=' * 70}")
    print("■ 月別集計結果")
    print(f"{'=' * 70}")
    print()
    print(f"{'月':<12} {'一般媒介':>10} {'専任媒介':>10} {'合計':>8}")
    print(f"{'-' * 42}")

    # 月でソート（日付不明は最後）
    sorted_months = sorted(
        monthly_stats.keys(),
        key=lambda x: x if x != '日付不明' else 'zzz'
    )

    for month in sorted_months:
        stats = monthly_stats[month]
        total = stats['一般媒介'] + stats['専任媒介']
        print(f"{month:<12} {stats['一般媒介']:>10} {stats['専任媒介']:>10} {total:>8}")

    print(f"{'-' * 42}")
    grand_total = total_stats['一般媒介'] + total_stats['専任媒介']
    print(f"{'合計':<12} {total_stats['一般媒介']:>10} {total_stats['専任媒介']:>10} {grand_total:>8}")

    print(f"\n■ 該当件数: {len(matched_rows)}件")
    print(f"  - 一般媒介: {total_stats['一般媒介']}件")
    print(f"  - 専任媒介: {total_stats['専任媒介']}件")

    # 直近のデータを数件表示
    if matched_rows:
        print(f"\n■ 該当データサンプル（最新5件）")
        print(f"  {'行':>5} {'K列':>4} {'AA列（訪問日）':<20} {'AC列（状況）':<12}")
        for item in matched_rows[-5:]:
            print(f"  {item['row']:>5} {item['k']:>4} {item['aa']:<20} {item['ac']:<12}")


if __name__ == '__main__':
    main()
