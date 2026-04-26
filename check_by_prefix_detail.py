#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BY_プレフィックスのレコードの詳細と、同名の正規レコードを比較する
"""
from supabase import create_client

SUPABASE_URL = "https://krxhrbtlgfjzsseegaqq.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyeGhyYnRsZ2ZqenNzZWVnYXFxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzAyMTQxMSwiZXhwIjoyMDc4NTk3NDExfQ.nog3UX9J9OgfqlCIPJt_sU_exE6Ny-nSj_HmwgV3oA8"
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# BY_レコードを取得
by_records = supabase.table('buyers').select('*').like('buyer_number', 'BY_%').execute().data or []

print("=" * 70)
print("BY_プレフィックスレコードの詳細")
print("=" * 70)

for r in by_records:
    name = r.get('name', '')
    print(f"\n【{r['buyer_number']}】 {name}")
    print(f"  reception_date : {r.get('reception_date')}")
    print(f"  latest_status  : {r.get('latest_status')}")
    print(f"  property_number: {r.get('property_number')}")
    print(f"  created_at     : {r.get('created_datetime')}")
    print(f"  deleted_at     : {r.get('deleted_at')}")
    
    # 同じ名前の正規レコードを検索（数字のbuyer_number）
    if name:
        # 名前の一部で検索
        name_part = name.split('　')[0].split(' ')[0][:4]
        similar = supabase.table('buyers').select(
            'buyer_id, buyer_number, name, reception_date, latest_status'
        ).ilike('name', f'%{name_part}%').not_.like('buyer_number', 'BY_%').execute().data or []
        
        if similar:
            print(f"  → 同名の正規レコード ({len(similar)}件):")
            for s in similar[:3]:
                print(f"     buyer_number={s['buyer_number']}  name={s['name']}  status={s['latest_status']}")
