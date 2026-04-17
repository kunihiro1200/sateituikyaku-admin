"""
一括同期スクリプト: 買主CH~CN列 DB->スプレッドシート

対象: 2026年1月1日以降に作成された買主で、
      property_number が存在し、かつ pre_viewing_notes が空欄のもの

実行方法:
  python sync-ch-cn-bulk.py [--dry-run]
"""

import os
import sys
import json
import time
import argparse
from datetime import datetime

try:
    import requests
    from google.oauth2 import service_account
    from googleapiclient.discovery import build
except ImportError as e:
    print("pip install requests google-auth google-api-python-client")
    sys.exit(1)

# ============================================================
# 設定
# ============================================================

SUPABASE_URL = "https://krxhrbtlgfjzsseegaqq.supabase.co"
SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyeGhyYnRsZ2ZqenNzZWVnYXFxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzAyMTQxMSwiZXhwIjoyMDc4NTk3NDExfQ.nog3UX9J9OgfqlCIPJt_sU_exE6Ny-nSj_HmwgV3oA8"

SPREADSHEET_ID = "1tI_iXaiLuWBggs5y0RH7qzkbHs9wnLLdRekAmjkhcLY"
SHEET_NAME = "買主リスト"
TARGET_FROM_DATE = "2026-01-01"

# CH~CN列マッピング（DBカラム名 -> スプレッドシート列名）
CH_CN_MAPPING = {
    "pre_viewing_notes":       "内覧前伝達事項",
    "key_info":                "鍵等",
    "sale_reason":             "売却理由",
    "price_reduction_history": "値下げ履歴",
    "viewing_notes":           "内覧の時の伝達事項",
    "parking":                 "駐車場",
    "viewing_parking":         "内覧時駐車場",
}

# property_listings から取得するフィールド（key_info は buyers テーブルにある）
PROPERTY_LISTING_FIELDS = [
    "pre_viewing_notes", "sale_reason", "price_reduction_history",
    "viewing_notes", "parking", "viewing_parking",
]

BUYER_FIELDS = ["key_info"]


def prt(text):
    """Windows cp932 環境でも安全に出力する"""
    try:
        print(text)
    except UnicodeEncodeError:
        print(text.encode("cp932", errors="replace").decode("cp932"))


# ============================================================
# Service Account JSON 読み込み
# ============================================================

def load_service_account_json():
    env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env.local")
    if not os.path.exists(env_path):
        return os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON", "")
    with open(env_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line.startswith("GOOGLE_SERVICE_ACCOUNT_JSON="):
                val = line[len("GOOGLE_SERVICE_ACCOUNT_JSON="):]
                if val.startswith('"') and val.endswith('"'):
                    val = val[1:-1]
                return val
    return ""


# ============================================================
# Supabase
# ============================================================

def supabase_get(table, params):
    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": "Bearer " + SUPABASE_SERVICE_KEY,
    }
    resp = requests.get(
        SUPABASE_URL + "/rest/v1/" + table,
        headers=headers,
        params=params,
    )
    resp.raise_for_status()
    return resp.json()


def get_target_buyers():
    prt("[Supabase] 対象買主を取得中...")
    prt("  条件: property_number あり かつ pre_viewing_notes 空欄")
    prt("  期間: created_datetime >= " + TARGET_FROM_DATE + " OR created_datetime is null")

    all_buyers = []

    # 1) created_datetime >= 2026-01-01 のもの
    params1 = {
        "select": "buyer_number,property_number,pre_viewing_notes,key_info,created_datetime",
        "created_datetime": "gte." + TARGET_FROM_DATE,
        "property_number": "not.is.null",
        "order": "buyer_number.asc",
        "limit": "2000",
    }
    all_buyers += supabase_get("buyers", params1)

    # 2) created_datetime が null のもの（スプシから取り込まれた古いデータ等）
    params2 = {
        "select": "buyer_number,property_number,pre_viewing_notes,key_info,created_datetime",
        "created_datetime": "is.null",
        "property_number": "not.is.null",
        "order": "buyer_number.asc",
        "limit": "2000",
    }
    all_buyers += supabase_get("buyers", params2)

    # 重複除去（buyer_number で）
    seen = set()
    unique = []
    for b in all_buyers:
        bn = b.get("buyer_number")
        if bn not in seen:
            seen.add(bn)
            unique.append(b)

    target = [
        b for b in unique
        if b.get("property_number") and str(b["property_number"]).strip()
        and not b.get("pre_viewing_notes")
    ]
    prt("[Supabase] 取得: " + str(len(unique)) + "件 -> 対象: " + str(len(target)) + "件")
    return target


def get_property_info(property_number):
    fields = ",".join(PROPERTY_LISTING_FIELDS)
    params = {
        "select": fields,
        "property_number": "eq." + property_number,
        "limit": "1",
    }
    rows = supabase_get("property_listings", params)
    return rows[0] if rows else {}


# ============================================================
# Google Sheets
# ============================================================

def build_sheets_service(sa_json_str):
    sa_info = json.loads(sa_json_str)
    creds = service_account.Credentials.from_service_account_info(
        sa_info,
        scopes=["https://www.googleapis.com/auth/spreadsheets"],
    )
    return build("sheets", "v4", credentials=creds)


def get_sheet_headers(service):
    result = service.spreadsheets().values().get(
        spreadsheetId=SPREADSHEET_ID,
        range=SHEET_NAME + "!1:1",
    ).execute()
    return result.get("values", [[]])[0]


def get_all_buyer_rows(service):
    """E列を一度だけ全取得して {buyer_number_str: row_number} のマップを返す"""
    result = service.spreadsheets().values().get(
        spreadsheetId=SPREADSHEET_ID,
        range=SHEET_NAME + "!E:E",
        valueRenderOption="UNFORMATTED_VALUE",
    ).execute()
    values = result.get("values", [])
    mapping = {}
    for i, row in enumerate(values):
        if row:
            mapping[str(row[0]).strip()] = i + 1  # 1-indexed
    return mapping


def index_to_col_letter(index):
    result = ""
    index += 1
    while index > 0:
        index, r = divmod(index - 1, 26)
        result = chr(65 + r) + result
    return result


def get_col_letter(headers, col_name):
    try:
        return index_to_col_letter(headers.index(col_name))
    except ValueError:
        return None


def write_to_sheet(service, row_number, headers, updates, dry_run):
    data = []
    for col_name, value in updates.items():
        col_letter = get_col_letter(headers, col_name)
        if not col_letter:
            prt("  [WARN] 列 '" + col_name + "' がヘッダーに見つかりません")
            continue
        cell = SHEET_NAME + "!" + col_letter + str(row_number)
        data.append({"range": cell, "values": [[value if value is not None else ""]]})

    if not data:
        return False

    if dry_run:
        prt("  [DRY-RUN] 行" + str(row_number) + " に書き込む予定:")
        for d in data:
            try:
                prt("    " + d["range"] + " = " + repr(d["values"][0][0]))
            except Exception:
                prt("    " + d["range"] + " = (表示不可)")
        return True

    body = {"valueInputOption": "USER_ENTERED", "data": data}
    service.spreadsheets().values().batchUpdate(
        spreadsheetId=SPREADSHEET_ID, body=body
    ).execute()
    return True


# ============================================================
# メイン
# ============================================================

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    dry_run = args.dry_run

    if dry_run:
        prt("=" * 50)
        prt("DRY-RUN: 実際の書き込みは行いません")
        prt("=" * 50)

    prt("開始: " + datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    prt("対象期間: " + TARGET_FROM_DATE + " 以降 / 条件: property_number あり かつ CH列空欄")

    target_buyers = get_target_buyers()
    if not target_buyers:
        prt("対象買主が見つかりませんでした。")
        return

    prt("\n対象: " + str(len(target_buyers)) + "件\n")

    sa_json = load_service_account_json()
    if not sa_json:
        prt("[ERROR] GOOGLE_SERVICE_ACCOUNT_JSON が取得できません")
        sys.exit(1)

    prt("[Google Sheets] 認証中...")
    service = build_sheets_service(sa_json)
    headers = get_sheet_headers(service)
    prt("[Google Sheets] ヘッダー取得完了 (" + str(len(headers)) + "列)")

    # E列を一度だけ全取得してキャッシュ（レート制限対策）
    prt("[Google Sheets] 買主番号マップを構築中...")
    buyer_row_map = get_all_buyer_rows(service)
    prt("[Google Sheets] " + str(len(buyer_row_map)) + "件の買主番号を取得\n")

    success = skip = error = 0

    for i, buyer in enumerate(target_buyers, 1):
        buyer_number = str(buyer["buyer_number"])
        property_number = str(buyer["property_number"])

        prt("[" + str(i) + "/" + str(len(target_buyers)) + "] 買主: " + buyer_number + " / 物件: " + property_number)

        prop_info = get_property_info(property_number)
        if not prop_info:
            prt("  [SKIP] property_listings に物件番号 " + property_number + " が見つかりません")
            skip += 1
            continue

        updates = {}
        has_value = False
        for db_col, sheet_col in CH_CN_MAPPING.items():
            if db_col in BUYER_FIELDS:
                val = buyer.get(db_col)
            else:
                val = prop_info.get(db_col)
            updates[sheet_col] = val if val is not None else ""
            if val:
                has_value = True

        if not has_value:
            prt("  [SKIP] 7フィールドすべて空")
            skip += 1
            continue

        row_number = buyer_row_map.get(str(buyer_number).strip())
        if not row_number:
            prt("  [SKIP] スプレッドシートに買主番号 " + buyer_number + " が見つかりません")
            skip += 1
            continue

        prt("  -> 行" + str(row_number) + " に書き込み")

        try:
            write_to_sheet(service, row_number, headers, updates, dry_run)
            success += 1
            if not dry_run:
                prt("  [OK] 完了")
        except Exception as e:
            prt("  [ERROR] " + str(e))
            error += 1

        if not dry_run:
            time.sleep(0.1)  # 書き込みのみ少し待機（読み込みはキャッシュ済み）

    prt("\n" + "=" * 50)
    prt("完了: 成功=" + str(success) + " スキップ=" + str(skip) + " エラー=" + str(error))
    prt("終了: " + datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    prt("=" * 50)


if __name__ == "__main__":
    main()
