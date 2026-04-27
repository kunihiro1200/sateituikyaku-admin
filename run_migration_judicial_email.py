# -*- coding: utf-8 -*-
import os

try:
    from supabase import create_client
except ImportError:
    os.system("pip install supabase")
    from supabase import create_client

SUPABASE_URL = "https://krxhrbtlgfjzsseegaqq.supabase.co"
SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyeGhyYnRsZ2ZqenNzZWVnYXFxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzAyMTQxMSwiZXhwIjoyMDc4NTk3NDExfQ.nog3UX9J9OgfqlCIPJt_sU_exE6Ny-nSj_HmwgV3oA8"

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

try:
    result = supabase.rpc('exec_sql', {
        'sql': "ALTER TABLE work_tasks ADD COLUMN IF NOT EXISTS judicial_scrivener_email TEXT;"
    }).execute()
    print("OK: judicial_scrivener_email column added")
except Exception as e:
    print(f"RPC failed: {e}")
    try:
        check = supabase.table('work_tasks').select('judicial_scrivener_email').limit(1).execute()
        print("Column already exists (select succeeded)")
    except Exception as e2:
        print(f"Column does not exist yet: {e2}")
        print("\nPlease run this SQL manually in Supabase dashboard:")
        print("ALTER TABLE work_tasks ADD COLUMN IF NOT EXISTS judicial_scrivener_email TEXT;")
