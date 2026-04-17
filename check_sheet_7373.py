"""
スプレッドシートで7373の行を直接確認するスクリプト
GOOGLE_SERVICE_ACCOUNT_JSON環境変数を使用
"""
import os, json, tempfile

# .env.localから環境変数を読み込む
env_vars = {}
for env_file in ['backend/.env.local', 'backend/.env']:
    if os.path.exists(env_file):
        with open(env_file, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, _, val = line.partition('=')
                    env_vars[key.strip()] = val.strip().strip('"')

spreadsheet_id = env_vars.get('GOOGLE_SHEETS_BUYER_SPREADSHEET_ID', '').strip()
print(f"Spreadsheet ID: {spreadsheet_id}")

# サービスアカウントJSONを一時ファイルに書き出す
sa_json_str = env_vars.get('GOOGLE_SERVICE_ACCOUNT_JSON', '')
if not sa_json_str:
    print("GOOGLE_SERVICE_ACCOUNT_JSON not found")
    exit(1)

# JSONをパース（エスケープされた改行を処理）
sa_json = json.loads(sa_json_str)

# 一時ファイルに書き出す
with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False, encoding='utf-8') as f:
    json.dump(sa_json, f)
    tmp_path = f.name

try:
    from google.oauth2 import service_account
    from googleapiclient.discovery import build

    credentials = service_account.Credentials.from_service_account_file(
        tmp_path,
        scopes=['https://www.googleapis.com/auth/spreadsheets.readonly']
    )
    service = build('sheets', 'v4', credentials=credentials)

    # E列（買主番号）を全行取得
    result = service.spreadsheets().values().get(
        spreadsheetId=spreadsheet_id,
        range="'買主リスト'!E:E",
        valueRenderOption='UNFORMATTED_VALUE'
    ).execute()

    values = result.get('values', [])
    print(f"買主番号列（E列）の総行数: {len(values)}")

    # 7373を探す
    found_rows = []
    for i, row in enumerate(values):
        if row and str(row[0]).strip() == '7373':
            found_rows.append(i + 1)  # 1-indexed

    if found_rows:
        print(f"\n✅ 7373が見つかった行番号: {found_rows}")
        for row_num in found_rows:
            detail = service.spreadsheets().values().get(
                spreadsheetId=spreadsheet_id,
                range=f"'買主リスト'!A{row_num}:J{row_num}",
                valueRenderOption='UNFORMATTED_VALUE'
            ).execute()
            print(f"  行{row_num}の内容（A〜J列）: {detail.get('values', [])}")
    else:
        print("\n❌ 7373が見つかりません（E列に存在しない）")
        # 近い番号を確認
        print("\n近い番号（7370〜7380）:")
        for i, row in enumerate(values):
            if row:
                val = str(row[0]).strip()
                if val in ['7370','7371','7372','7373','7374','7375','7376','7377','7378','7379','7380']:
                    print(f"  行{i+1}: '{val}'")

        # 7373に近い数値を探す（数値として格納されている場合）
        print("\n数値7373として格納されている行:")
        for i, row in enumerate(values):
            if row:
                try:
                    if float(str(row[0]).strip()) == 7373:
                        print(f"  行{i+1}: {row[0]} (型: {type(row[0]).__name__})")
                except:
                    pass

finally:
    os.unlink(tmp_path)
