#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BY_プレフィックスのbuyer_numberを持つレコードを調査するスクリプト
"""

from supabase import create_client, Client

SUPABASE_URL = "https://krxhrbtlgfjzsseegaqq.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyeGhyYnRsZ2ZqenNzZWVnYXFxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzAyMTQxMSwiZXhwIjoyMDc4NTk3NDExfQ.nog3UX9J9OgfqlCIPJt_sU_exE6Ny-nSj_HmwgV3oA8"

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

print("=" * 70)
print("BY_プレフィックスのbuyer_numberを持つレコード調査")
print("=" * 70)

# BY_で始まるbuyer_numberを検索
response = supabase.table('buyers').select(
    'buyer_id, buyer_number, name, reception_date, latest_status, deleted_at, created_datetime'
).like('buyer_number', 'BY_%').execute()

records = response.data or []
print(f"\n件数: {len(records)}件\n")

for r in records:
    print(f"  buyer_id    : {r.get('buyer_id')}")
    print(f"  buyer_number: {r.get('buyer_number')}")
    print(f"  name        : {r.get('name')}")
    print(f"  reception_date: {r.get('reception_date')}")
    print(f"  latest_status : {r.get('latest_status')}")
    print(f"  deleted_at  : {r.get('deleted_at')}")
    print(f"  created_at  : {r.get('created_datetime')}")
    print()
