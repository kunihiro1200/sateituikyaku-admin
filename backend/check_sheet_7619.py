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

# E列で7617〜7619を探す
result = service.spreadsheets().values().get(
    spreadsheetId=SPREADSHEET_ID,
    range=SHEET_NAME + "!E:E",
    valueRenderOption="UNFORMATTED_VALUE",
).execute()
values = result.get("values", [])

target_rows = {}
for i, row in enumerate(values):
    if row and str(row[0]).strip() in ("7617", "7618", "7619"):
        target_rows[str(row[0]).strip()] = i + 1

print("対象行:", target_rows)

# 各行のCH〜CN列（列86〜92、0-indexed: 85〜91）を取得
# CH=86列目(0-indexed:85), CI=87, CJ=88, CK=89, CL=90, CM=91, CN=92
for buyer_num, row_num in sorted(target_rows.items()):
    result2 = service.spreadsheets().values().get(
        spreadsheetId=SPREADSHEET_ID,
        range=SHEET_NAME + "!CH" + str(row_num) + ":CN" + str(row_num),
        valueRenderOption="UNFORMATTED_VALUE",
    ).execute()
    vals = result2.get("values", [[]])
    row_vals = vals[0] if vals else []
    print("買主" + buyer_num + " 行" + str(row_num) + " CH~CN:", row_vals)
