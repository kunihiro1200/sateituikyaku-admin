#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv('backend/.env')
supabase = create_client(os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_SERVICE_KEY"))

# visit_dateの生の値を確認
res = supabase.table('sellers').select('seller_number,visit_date,visit_time,visit_acquisition_date').eq('seller_number', 'AA2708').execute()
print(res.data)
