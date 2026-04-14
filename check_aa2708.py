#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv('backend/.env')

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_KEY")
supabase: Client = create_client(url, key)

response = supabase.table('sellers').select(
    'seller_number, visit_date, visit_acquisition_date, visit_assignee, visit_time, status, updated_at'
).eq('seller_number', 'AA2708').execute()

sellers = response.data
if sellers:
    s = sellers[0]
    print(f"seller_number: {s['seller_number']}")
    print(f"visit_date: {s['visit_date']}")
    print(f"visit_acquisition_date: {s['visit_acquisition_date']}")
    print(f"visit_assignee: {s['visit_assignee']}")
    print(f"visit_time: {s['visit_time']}")
    print(f"status: {s['status']}")
    print(f"updated_at: {s['updated_at']}")
else:
    print("AA2708 not found in DB")
