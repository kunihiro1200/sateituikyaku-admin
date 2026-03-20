with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

old = '''                  <a
                    href="https://docs.google.com/spreadsheets/d/1wKBRLWbT6pSKa9IlTDabjhjTnfs_GxX6Rn6M6kbio1I"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#1976d2', fontSize: '0.875rem', wordBreak: 'break-all' }}
                  >
                    つながるオンラインを開く
                  </a>'''

new = '''                  <a
                    href="https://docs.google.com/spreadsheets/d/1wKBRLWbT6pSKa9IlTDabjhjTnfs_GxX6Rn6M6kbio1I"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    style={{ color: '#1976d2', fontSize: '0.875rem', wordBreak: 'break-all' }}
                  >
                    つながるオンラインを開く
                  </a>'''

if old in text:
    text = text.replace(old, new)
    with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
        f.write(text.encode('utf-8'))
    print('OK: stopPropagation added')
else:
    print('ERROR: target string not found')
