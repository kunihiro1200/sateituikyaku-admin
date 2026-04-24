# -*- coding: utf-8 -*-
# 118_add_countermeasure_fields マイグレーション実行スクリプト
import os
import sys

try:
    from supabase import create_client
except ImportError:
    print("supabase-py not installed. Trying pip install...")
    os.system("pip install supabase")
    from supabase import create_client

SUPABASE_URL = "https://krxhrbtlgfjzsseegaqq.supabase.co"
SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyeGhyYnRsZ2ZqenNzZWVnYXFxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzAyMTQxMSwiZXhwIjoyMDc4NTk3NDExfQ.nog3UX9J9OgfqlCIPJt_sU_exE6Ny-nSj_HmwgV3oA8"

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# 各カラムを個別に追加（IF NOT EXISTSで冪等性を確保）
columns = [
    ("mediation_revision_countermeasure", "TEXT"),
    ("site_registration_revision_countermeasure", "TEXT"),
    ("floor_plan_revision_countermeasure", "TEXT"),
    ("contract_revision_countermeasure", "TEXT"),
]

for col_name, col_type in columns:
    try:
        result = supabase.rpc('exec_sql', {
            'sql': f"ALTER TABLE work_tasks ADD COLUMN IF NOT EXISTS {col_name} {col_type};"
        }).execute()
        print(f"OK: {col_name}")
    except Exception as e:
        print(f"RPC failed for {col_name}: {e}")
        # 代替: REST API経由でテーブルにアクセスして確認
        try:
            check = supabase.table('work_tasks').select(col_name).limit(1).execute()
            print(f"  Column {col_name} already exists (select succeeded)")
        except Exception as e2:
            print(f"  Column {col_name} does not exist: {e2}")

print("\nDone! Please run the SQL manually in Supabase dashboard if needed:")
print("""
ALTER TABLE work_tasks
  ADD COLUMN IF NOT EXISTS mediation_revision_countermeasure TEXT,
  ADD COLUMN IF NOT EXISTS site_registration_revision_countermeasure TEXT,
  ADD COLUMN IF NOT EXISTS floor_plan_revision_countermeasure TEXT,
  ADD COLUMN IF NOT EXISTS contract_revision_countermeasure TEXT;
""")
