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

# UNFORMATTED_VALUE で取得（数値は数値のまま返る）
result = service.spreadsheets().values().get(
    spreadsheetId="1tI_iXaiLuWBggs5y0RH7qzkbHs9wnLLdRekAmjkhcLY",
    range="買主リスト!E:E",
    valueRenderOption="UNFORMATTED_VALUE",
).execute()
values = result.get("values", [])

# 7611を探す（文字列・数値両方）
found = False
for i, row in enumerate(values):
    if row and (str(row[0]).strip() == "7611" or row[0] == 7611):
        print("行" + str(i+1) + ": 値=" + repr(row[0]) + " 型=" + type(row[0]).__name__)
        found = True
        break

if not found:
    print("7611が見つかりません")

# 最後の20行を確認
print("\n--- 最後の20行 ---")
for i, row in enumerate(values[-20:], len(values)-19):
    if row:
        print("行" + str(i) + ": " + repr(row[0]) + " 型=" + type(row[0]).__name__)
