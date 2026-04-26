#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from supabase import create_client

SUPABASE_URL = "https://krxhrbtlgfjzsseegaqq.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyeGhyYnRsZ2ZqenNzZWVnYXFxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzAyMTQxMSwiZXhwIjoyMDc4NTk3NDExfQ.nog3UX9J9OgfqlCIPJt_sU_exE6Ny-nSj_HmwgV3oA8"
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

r = supabase.table('buyers').select('buyer_id, buyer_number, name').is_('buyer_id', 'null').execute()
print(f"buyer_id=NULLのレコード: {len(r.data)}件")
for x in r.data:
    print(f"  buyer_number={x['buyer_number']}  name={x['name']}")
