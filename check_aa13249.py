#!/usr/bin/env python3
import os
from supabase import create_client
from dotenv import load_dotenv
load_dotenv('backend/.env')
sb = create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_SERVICE_KEY'])

r = sb.table('property_listings').select('property_number, atbb_status, sidebar_status').eq('property_number', 'AA13249').execute()
print(f'AA13249の件数: {len(r.data)}')
for row in r.data:
    print(f"  atbb_status='{row.get('atbb_status')}', sidebar_status='{row.get('sidebar_status')}'")
