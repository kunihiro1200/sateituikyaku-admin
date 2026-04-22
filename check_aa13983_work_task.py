import os
import requests
from dotenv import load_dotenv

load_dotenv('backend/.env.local')

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_KEY') or os.getenv('SUPABASE_ANON_KEY')

headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': f'Bearer {SUPABASE_KEY}',
    'Content-Type': 'application/json'
}

url = f"{SUPABASE_URL}/rest/v1/work_tasks"
params = {
    'property_number': 'eq.AA13983',
    'select': 'property_number,site_registration_requestor,site_registration_requester,cw_request_email_site,site_registration_deadline,site_registration_confirmed,site_registration_confirm_request_date,on_hold,distribution_date,publish_scheduled_date,sales_contract_deadline'
}

response = requests.get(url, headers=headers, params=params)
data = response.json()

if data:
    task = data[0]
    print("=== AA13983 work_tasks データ ===")
    for key, value in task.items():
        print(f"  {key}: {repr(value)}")
else:
    print("データが見つかりません")
