with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# handleNavigate を navigate に変更（検索バーのonKeyDownハンドラーのみ）
old = """          onKeyDown={(e) => {
            if (e.key === 'Enter' && buyerNumberSearch.trim()) {
              handleNavigate(`/buyers/${toHalfWidth(buyerNumberSearch.trim())}`);
            }
          }}"""

new = """          onKeyDown={(e) => {
            if (e.key === 'Enter' && buyerNumberSearch.trim()) {
              navigate(`/buyers/${toHalfWidth(buyerNumberSearch.trim())}`);
            }
          }}"""

if old in text:
    text = text.replace(old, new)
    with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'wb') as f:
        f.write(text.encode('utf-8'))
    print('✅ Fixed: handleNavigate -> navigate in search bar onKeyDown handler')
else:
    print('❌ Pattern not found. Searching for current state...')
    idx = text.find('buyerNumberSearch.trim()')
    if idx >= 0:
        print(repr(text[idx-200:idx+200]))
