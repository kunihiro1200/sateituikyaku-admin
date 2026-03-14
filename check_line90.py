with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    content = f.read()
lines = content.split(b'\n')
line90 = lines[89]
print('Line 90 bytes:', repr(line90))
print('Length:', len(line90))
decoded = line90.decode('utf-8', errors='replace')
print('Decoded:', decoded)
if len(decoded) > 50:
    print('Char at 50:', repr(decoded[50]))
