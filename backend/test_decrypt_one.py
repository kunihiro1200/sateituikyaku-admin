import os
import sys
import base64
from pathlib import Path

# stdout を UTF-8 に設定
sys.stdout.reconfigure(encoding='utf-8')

# .env.local を読み込む
env_path = Path(__file__).parent / '.env.local'
with open(env_path, encoding='utf-8') as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            key, _, value = line.partition('=')
            value = value.strip()
            if (value.startswith('"') and value.endswith('"')) or (value.startswith("'") and value.endswith("'")):
                value = value[1:-1]
            os.environ[key.strip()] = value

ENCRYPTION_KEY = os.environ.get('ENCRYPTION_KEY', '')
print(f'ENCRYPTION_KEY length: {len(ENCRYPTION_KEY)}')
print(f'ENCRYPTION_KEY: {ENCRYPTION_KEY[:10]}...')

# AA13864 の暗号化済み address を復号テスト
test_value = 'D9UAbI6q6UUbe01lbdvnvj98MBMETZAQQpFipJN3vZKYoAPvLboebOhCHf8iOrGUkO1L3MH47BlMTKCiS6J1qB8Api7Y78QCwS4K0IURhAvT3JmUAMIGKEcqT8xWROOMkdS/Ie2Zylh5swyY9bMPt+fYAmyQqyvsXJdQdYnz37q5CQ=='

try:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    key = ENCRYPTION_KEY.encode('utf-8')
    combined = base64.b64decode(test_value)
    print(f'combined length: {len(combined)}')

    IV_LENGTH = 16
    SALT_LENGTH = 64
    TAG_LENGTH = 16

    iv = combined[:IV_LENGTH]
    tag = combined[IV_LENGTH + SALT_LENGTH:IV_LENGTH + SALT_LENGTH + TAG_LENGTH]
    encrypted = combined[IV_LENGTH + SALT_LENGTH + TAG_LENGTH:]

    print(f'iv: {iv.hex()}')
    print(f'tag: {tag.hex()}')
    print(f'encrypted length: {len(encrypted)}')

    aesgcm = AESGCM(key)
    decrypted = aesgcm.decrypt(iv, encrypted + tag, None)
    print(f'Decrypted: {decrypted.decode("utf-8")}')

except Exception as e:
    import traceback
    print(f'Error: {e}')
    traceback.print_exc()
