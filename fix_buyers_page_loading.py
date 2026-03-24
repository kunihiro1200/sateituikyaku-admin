with open('frontend/frontend/src/pages/BuyersPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# loading の初期値をキャッシュの有無で決定する
old = """  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [loading, setLoading] = useState(true);"""

new = """  const [buyers, setBuyers] = useState<Buyer[]>([]);
  // キャッシュがあれば初期ローディングをスキップ
  const [loading, setLoading] = useState(!pageDataCache.get(CACHE_KEYS.BUYERS_WITH_STATUS));"""

if old in text:
    text = text.replace(old, new)
    print('置換成功')
else:
    print('置換失敗')

with open('frontend/frontend/src/pages/BuyersPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('完了')
