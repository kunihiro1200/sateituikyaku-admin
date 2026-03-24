import re

with open('backend/src/config/redis.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# connectTimeout: 2000 -> 5000
text = text.replace('connectTimeout: 2000,', 'connectTimeout: 5000,')

# レースのタイムアウト 500 -> 3000
text = text.replace(
    "setTimeout(() => reject(new Error('Connection timeout')), 500)",
    "setTimeout(() => reject(new Error('Connection timeout')), 3000)"
)

with open('backend/src/config/redis.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done! redis.ts updated for Upstash (connectTimeout: 5000, race: 3000ms)')
