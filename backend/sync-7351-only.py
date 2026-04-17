import os, json, time
from supabase import create_client
from google.oauth2 import service_account
from googleapiclient.discovery import build

SPREADSHEET_ID = '1tI_iXaiLuWBggs5y0RH7qzkbHs9wnLLdRekAmjkhcLY'
SHEET_NAME = '買主リスト'
TARGET_FIELDS = [
    ('pre_viewing_notes', '内覧前伝達事項'),
    ('key_info', '鍵等'),
    ('sale_reason', '売却理由'),
    ('price_reduction_history', '値下げ履歴'),
    ('viewing_notes', '内覧の時の伝達事項'),
    ('parking', '駐車場'),
    ('viewing_parking', '内覧時駐車場'),
]

env_path = os.path.join(os.path.dirname(__file__), '.env.local')
env = {}
sa_info = None
with open(env_path, 'r', encoding='utf-8') as f:
    for line in f:
        if line.startswith('GOOGLE_SERVICE_ACCOUNT_JSON='):
            sa_info = json.loads(line[len('GOOGLE_SERVICE_ACCOUNT_JSON='):].strip().strip('"'))
        elif '=' in line and not line.startswith('#'):
            k, _, v = line.partition('=')
            env[k.strip()] = v.strip().strip('"')

client = create_client(env['SUPABASE_URL'], env['SUPABASE_SERVICE_KEY'])
buyer = client.table('buyers').select('buyer_number,' + ','.join(f[0] for f in TARGET_FIELDS)).eq('buyer_number', '7351').execute().data[0]
print('buyer data:', {f[0]: buyer.get(f[0]) for f in TARGET_FIELDS})

creds = service_account.Credentials.from_service_account_info(sa_info, scopes=['https://www.googleapis.com/auth/spreadsheets'])
service = build('sheets', 'v4', credentials=creds)
sheets = service.spreadsheets()

headers = sheets.values().get(spreadsheetId=SPREADSHEET_ID, range=f"'{SHEET_NAME}'!1:1").execute().get('values', [[]])[0]
sp = sheets.get(spreadsheetId=SPREADSHEET_ID).execute()
sheet_id = next(s['properties']['sheetId'] for s in sp['sheets'] if s['properties']['title'] == SHEET_NAME)
data = sheets.values().get(spreadsheetId=SPREADSHEET_ID, range=f"'{SHEET_NAME}'!A2:GZ", valueRenderOption='UNFORMATTED_VALUE').execute().get('values', [])

bc = headers.index('買主番号')
ri = next(i for i, r in enumerate(data) if len(r) > bc and str(r[bc]) == '7351')
rn = ri + 2

reqs = []
for db_f, col_n in TARGET_FIELDS:
    v = buyer.get(db_f)
    if v is None or v == '': continue
    ci = headers.index(col_n)
    reqs.append({'updateCells': {'range': {'sheetId': sheet_id, 'startRowIndex': rn-1, 'endRowIndex': rn, 'startColumnIndex': ci, 'endColumnIndex': ci+1}, 'rows': [{'values': [{'userEnteredValue': {'stringValue': str(v)}}]}], 'fields': 'userEnteredValue'}})

print(f'Updating row {rn} with {len(reqs)} fields...')
sheets.batchUpdate(spreadsheetId=SPREADSHEET_ID, body={'requests': reqs}).execute()
print(f'✅ 買主7351 (行{rn}) 同期完了')
