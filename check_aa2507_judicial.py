import json, ssl, urllib.request, urllib.parse, time, base64

key_path = r'C:\Users\kunih\sateituikyaku-admin\backend\google-service-account.json'
with open(key_path) as f:
    sa = json.load(f)

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.backends import default_backend

now = int(time.time())
header = base64.urlsafe_b64encode(json.dumps({'alg':'RS256','typ':'JWT'}).encode()).rstrip(b'=').decode()
payload_dict = {
    'iss': sa['client_email'],
    'scope': 'https://www.googleapis.com/auth/spreadsheets.readonly',
    'aud': 'https://oauth2.googleapis.com/token',
    'exp': now + 3600,
    'iat': now
}
payload = base64.urlsafe_b64encode(json.dumps(payload_dict).encode()).rstrip(b'=').decode()

private_key = serialization.load_pem_private_key(sa['private_key'].encode(), password=None, backend=default_backend())
sig_input = f'{header}.{payload}'.encode()
signature = private_key.sign(sig_input, padding.PKCS1v15(), hashes.SHA256())
sig_b64 = base64.urlsafe_b64encode(signature).rstrip(b'=').decode()
jwt = f'{header}.{payload}.{sig_b64}'

data = urllib.parse.urlencode({
    'grant_type': 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    'assertion': jwt
}).encode()

ctx = ssl.create_default_context()
req = urllib.request.Request('https://oauth2.googleapis.com/token', data=data,
    headers={'Content-Type': 'application/x-www-form-urlencoded'})
with urllib.request.urlopen(req, context=ctx) as r:
    token_data = json.loads(r.read())
access_token = token_data['access_token']
print('トークン取得成功')

spreadsheet_id = '1MO2vs0mDUFCgM-rjXXPRIy3pKKdfIFvUDwacM-2174g'

# ヘッダー行取得
url = f'https://sheets.googleapis.com/v4/spreadsheets/{spreadsheet_id}/values/%E6%A5%AD%E5%8B%99%E4%BE%9D%E9%A0%BC!1:1'
req2 = urllib.request.Request(url, headers={'Authorization': f'Bearer {access_token}'})
with urllib.request.urlopen(req2, context=ctx) as r:
    headers_data = json.loads(r.read())
headers = headers_data['values'][0]

bv_idx = headers.index('司法書士') if '司法書士' in headers else -1
bw_idx = headers.index('司法書士連絡先') if '司法書士連絡先' in headers else -1
print(f'司法書士 列インデックス: {bv_idx} (列{bv_idx+1})')
print(f'司法書士連絡先 列インデックス: {bw_idx} (列{bw_idx+1})')

# A列全体を取得してAA2507の行番号を探す
url2 = f'https://sheets.googleapis.com/v4/spreadsheets/{spreadsheet_id}/values/%E6%A5%AD%E5%8B%99%E4%BE%9D%E9%A0%BC!A:A'
req3 = urllib.request.Request(url2, headers={'Authorization': f'Bearer {access_token}'})
with urllib.request.urlopen(req3, context=ctx) as r:
    col_a = json.loads(r.read())
rows_a = col_a.get('values', [])
row_num = None
for i, row in enumerate(rows_a):
    if row and row[0] == 'AA2507':
        row_num = i + 1  # 1-indexed
        break

if row_num is None:
    print('AA2507が見つかりません')
else:
    print(f'AA2507は{row_num}行目')
    # BV・BW列の値を取得
    import string
    def col_letter(n):
        s = ''
        while n > 0:
            n, r = divmod(n-1, 26)
            s = chr(65+r) + s
        return s
    bv_letter = col_letter(bv_idx+1)
    bw_letter = col_letter(bw_idx+1)
    range_str = f'%E6%A5%AD%E5%8B%99%E4%BE%9D%E9%A0%BC!{bv_letter}{row_num}:{bw_letter}{row_num}'
    url3 = f'https://sheets.googleapis.com/v4/spreadsheets/{spreadsheet_id}/values/{range_str}'
    req4 = urllib.request.Request(url3, headers={'Authorization': f'Bearer {access_token}'})
    with urllib.request.urlopen(req4, context=ctx) as r:
        cell_data = json.loads(r.read())
    print(f'スプシのAA2507 BV({bv_letter})列(司法書士): {cell_data.get("values")}')
