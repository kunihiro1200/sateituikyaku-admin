import os
from pathlib import Path

env_path = Path(__file__).parent / '.env.local'
with open(env_path, encoding='utf-8') as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            key, _, value = line.partition('=')
            value = value.strip()
            if (value.startswith('"') and value.endswith('"')) or (value.startswith("'") and value.endswith("'")):
                value = value[1:-1]
            os.environ.setdefault(key.strip(), value)

key = os.environ.get('SUPABASE_SERVICE_KEY', '')
print('KEY_LEN:', len(key))
print('KEY_START:', key[:20])
print('URL:', os.environ.get('SUPABASE_URL', ''))
