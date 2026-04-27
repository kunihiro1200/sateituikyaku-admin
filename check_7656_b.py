#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import os
from supabase import create_client
from dotenv import load_dotenv
from datetime import datetime, timezone, timedelta
load_dotenv('backend/.env')
url = os.environ.get('SUPABASE_URL')
key = os.environ.get('SUPABASE_SERVICE_KEY')
sb = create_client(url, key)

jst_now = datetime.now(timezone(timedelta(hours=9)))
today_str = jst_now.strftime('%Y-%m-%d')
print('今日（JST）:', today_str)

res = sb.table('buyers').select('buyer_number, next_call_date, follow_up_assignee').eq('follow_up_assignee', '林').is_('deleted_at', None).execute()
print('林担当の買主数:', len(res.data))
for b in res.data:
    ncd = b.get('next_call_date')
    if ncd and ncd[:10] <= today_str:
        print('  当日TEL(林)該当:', b['buyer_number'], 'next_call_date=', ncd[:10])
