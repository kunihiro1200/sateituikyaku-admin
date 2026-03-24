import re

with open('frontend/frontend/src/pages/BuyersPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 問題1: useEffectの中でsetLoading(true)が毎回呼ばれている
# キャッシュヒット時（sidebarLoaded && allBuyersWithStatusRef.current.length > 0）は
# setLoading(true)をスキップする

old = """    const fetchBuyers = async () => {
      try {
        setLoading(true);

        // サイドバーデータ読み込み済みの場合はフロント側でフィルタリング（APIコール不要）
        if (sidebarLoaded && allBuyersWithStatusRef.current.length > 0) {"""

new = """    const fetchBuyers = async () => {
      try {
        // サイドバーデータ読み込み済みの場合はフロント側でフィルタリング（APIコール不要）
        // キャッシュヒット時はsetLoading(true)をスキップして画面のちらつきを防ぐ
        if (sidebarLoaded && allBuyersWithStatusRef.current.length > 0) {"""

text = text.replace(old, new)

# 問題2: キャッシュヒット時のフィルタリング後にsetLoading(false)を呼ぶ前に
# setLoading(true)が呼ばれていないので、ローディング表示が残る可能性がある
# → キャッシュヒット時はsetLoading(false)だけ呼べばOK（既にfalseなら何もしない）

# 問題3: APIコール時のみsetLoading(true)を呼ぶ
old2 = """        // サイドバー未ロード時のみAPIから取得（初回表示用）
        const params: any = {"""

new2 = """        // サイドバー未ロード時のみAPIから取得（初回表示用）
        setLoading(true);
        const params: any = {"""

text = text.replace(old2, new2)

with open('frontend/frontend/src/pages/BuyersPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
print('変更内容:')
print('1. キャッシュヒット時はsetLoading(true)をスキップ')
print('2. APIコール時のみsetLoading(true)を呼ぶ')
