import os, json
from google.oauth2 import service_account
from googleapiclient.discovery import build

env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env.local")
sa_json = ""
with open(env_path, "r", encoding="utf-8") as f:
    for line in f:
        line = line.strip()
        if line.startswith("GOOGLE_SERVICE_ACCOUNT_JSON="):
            val = line[len("GOOGLE_SERVICE_ACCOUNT_JSON="):]
            if val.startswith('"') and val.endswith('"'):
                val = val[1:-1]
            sa_json = val
            break

sa_info = json.loads(sa_json)
creds = service_account.Credentials.from_service_account_info(
    sa_info, scopes=["https://www.googleapis.com/auth/spreadsheets"]
)
service = build("sheets", "v4", credentials=creds)

SPREADSHEET_ID = "1tI_iXaiLuWBggs5y0RH7qzkbHs9wnLLdRekAmjkhcLY"
SHEET_NAME = "買主リスト"

# ヘッダー行を取得
result = service.spreadsheets().values().get(
    spreadsheetId=SPREADSHEET_ID,
    range=SHEET_NAME + "!1:1",
).execute()
headers = result.get("values", [[]])[0]

# CH〜CN列（0-indexed: 85〜91）のヘッダーを確認
print("CH〜CN列のヘッダー:")
for i in range(85, 92):
    col_name = headers[i] if i < len(headers) else "(なし)"
    print(f"  列{i+1}({chr(65 + i//26 - 1) if i >= 26 else ''}{chr(65 + i % 26)}): {repr(col_name)}")

# databaseToSpreadsheetのマッピングと照合
mapping = {
    "pre_viewing_notes":       "内覧前伝達事項",
    "key_info":                "鍵等",
    "sale_reason":             "売却理由",
    "price_reduction_history": "値下げ履歴",
    "viewing_notes":           "内覧の時の伝達事項",
    "parking":                 "駐車場",
    "viewing_parking":         "内覧時駐車場",
}

print("\nマッピング照合:")
for db_col, sheet_col in mapping.items():
    if sheet_col in headers:
        idx = headers.index(sheet_col)
        print(f"  OK: {db_col} -> '{sheet_col}' (列{idx+1})")
    else:
        print(f"  NG: {db_col} -> '{sheet_col}' がヘッダーに見つかりません")
        # 近い名前を探す
        for h in headers:
            if any(c in h for c in sheet_col[:3]):
                print(f"      候補: {repr(h)}")
