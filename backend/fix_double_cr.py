with open('src/index.ts', 'rb') as f:
    raw = f.read()

# \r\r\n -> \r\n に修正（二重CRを除去）
fixed = raw.replace(b'\r\r\n', b'\r\n')
# \r\r -> \r\n に修正（残った二重CR）
fixed = fixed.replace(b'\r\r', b'\r\n')

print('Original size: ' + str(len(raw)))
print('Fixed size: ' + str(len(fixed)))

with open('src/index.ts', 'wb') as f:
    f.write(fixed)
print('Done')
