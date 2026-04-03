import gspread
from oauth2client.service_account import ServiceAccountCredentials
import json

# Google Sheets API認証
scope = ['https://spreadsheets.google.com/feeds', 'https://www.googleapis.com/auth/drive']
creds = ServiceAccountCredentials.from_json_keyfile_name('service-account-key.json', scope)
client = gspread.authorize(creds)

# スプレッドシートを開く
sheet = client.open('売主リスト').sheet1

# ヘッダー行を取得
headers = sheet.row_values(1)

# 売主番号の列インデックスを取得
seller_number_col = headers.index('売主番号') + 1

# 訪問日の列インデックスを取得
visit_date_cols = []
for i, header in enumerate(headers):
    if '訪問日' in header:
        visit_date_cols.append((i + 1, header))

print('=== 訪問日関連の列 ===')
for col_idx, col_name in visit_date_cols:
    print(f'列{col_idx}: {col_name}')

# AA13729の行を検索
all_seller_numbers = sheet.col_values(seller_number_col)
try:
    row_idx = all_seller_numbers.index('AA13729') + 1
    print(f'\n=== AA13729（行{row_idx}）の訪問日情報 ===')
    
    # 訪問日関連の値を取得
    for col_idx, col_name in visit_date_cols:
        value = sheet.cell(row_idx, col_idx).value
        print(f'{col_name}: {value}')
    
    # 営担も確認
    if '営担' in headers:
        visit_assignee_col = headers.index('営担') + 1
        visit_assignee = sheet.cell(row_idx, visit_assignee_col).value
        print(f'営担: {visit_assignee}')
    
except ValueError:
    print('❌ AA13729が見つかりません')
