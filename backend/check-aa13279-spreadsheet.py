import os
import json
from google.oauth2 import service_account
from googleapiclient.discovery import build
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()

# 認証情報を設定
SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly']
KEY_PATH = os.getenv('GOOGLE_SERVICE_ACCOUNT_KEY_PATH')
SPREADSHEET_ID = os.getenv('GOOGLE_SHEETS_SPREADSHEET_ID')

credentials = service_account.Credentials.from_service_account_file(
    KEY_PATH, scopes=SCOPES)

service = build('sheets', 'v4', credentials=credentials)

# ヘッダー行を取得
header_result = service.spreadsheets().values().get(
    spreadsheetId=SPREADSHEET_ID,
    range='売主リスト!1:1'
).execute()
headers = header_result.get('values', [])[0]

print('=== ヘッダー確認 ===')
print(f'営担の列番号: {headers.index("営担") if "営担" in headers else "見つからない"}')
visit_date_candidates = [i for i, h in enumerate(headers) if '訪問日' in h]
print(f'訪問日の列番号候補: {visit_date_candidates}')
if visit_date_candidates:
    print(f'訪問日のヘッダー: {[headers[i] for i in visit_date_candidates]}')

# AA13279を検索
seller_numbers_result = service.spreadsheets().values().get(
    spreadsheetId=SPREADSHEET_ID,
    range='売主リスト!B:B'
).execute()
seller_numbers = seller_numbers_result.get('values', [])

row_index = -1
for i, row in enumerate(seller_numbers):
    if row and row[0] == 'AA13279':
        row_index = i + 1  # 1-indexed
        break

if row_index == -1:
    print('\nAA13279がスプレッドシートに見つかりません')
    exit(1)

print(f'\nAA13279の行番号: {row_index}')

# その行のデータを取得
row_result = service.spreadsheets().values().get(
    spreadsheetId=SPREADSHEET_ID,
    range=f'売主リスト!{row_index}:{row_index}'
).execute()
row_data = row_result.get('values', [[]])[0]

print('\n=== スプレッドシートのAA13279 ===')
print(f'売主番号: {row_data[1] if len(row_data) > 1 else "（空）"}')

# 営担
visit_assignee_index = headers.index('営担') if '営担' in headers else -1
if visit_assignee_index != -1 and len(row_data) > visit_assignee_index:
    print(f'営担（列{visit_assignee_index}）: {row_data[visit_assignee_index] if row_data[visit_assignee_index] else "（空）"}')
else:
    print('営担: （列が見つからない）')

# 訪問日
visit_date_index = -1
for candidate in visit_date_candidates:
    if len(row_data) > candidate:
        visit_date_index = candidate
        break

if visit_date_index != -1 and len(row_data) > visit_date_index:
    visit_date_str = row_data[visit_date_index]
    print(f'訪問日（列{visit_date_index}）: {visit_date_str if visit_date_str else "（空）"}')
    
    # 今日の日付
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    print(f'\n今日: {today.strftime("%Y-%m-%d")}')
    
    if visit_date_str:
        # 日付をパース
        try:
            if '/' in visit_date_str:
                parts = visit_date_str.split('/')
                visit_date = datetime(int(parts[0]), int(parts[1]), int(parts[2]))
            else:
                visit_date = datetime.strptime(visit_date_str, '%Y-%m-%d')
            
            visit_day = visit_date.weekday()  # 0=月曜, 3=木曜
            days_before = 2 if visit_day == 3 else 1  # 木曜訪問のみ2日前
            
            notify_date = visit_date - timedelta(days=days_before)
            
            print(f'訪問日: {visit_date.strftime("%Y-%m-%d")} ({["月","火","水","木","金","土","日"][visit_day]}曜)')
            print(f'通知日（前営業日）: {notify_date.strftime("%Y-%m-%d")}')
            print(f'今日 === 通知日: {today == notify_date}')
        except Exception as e:
            print(f'日付のパースエラー: {e}')
else:
    print('訪問日: （列が見つからない）')
