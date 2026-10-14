import urllib.request
import re

url = "https://www.city.fukuoka.lg.jp/kyoiku-iinkai/tsuugaku/ed/area/tsugaku.html"
req = urllib.request.Request(url)
req.add_header("User-Agent", "Mozilla/5.0")
with urllib.request.urlopen(req, timeout=15) as r:
    content = r.read().decode("utf-8", errors="ignore")

# tsugaku- を含むリンクを全て抽出
links = re.findall(r'href=["\']([^"\']*tsugaku[^"\']*)["\']', content)
print("=== tsugakuリンク ===")
for l in sorted(set(links)):
    print(l)

# tsuugaku- も探す
links2 = re.findall(r'href=["\']([^"\']*area[^"\']*\.html)["\']', content)
print("\n=== area/*.html リンク ===")
for l in sorted(set(links2)):
    print(l)

# ページ内テキストから行名を探す
rows = re.findall(r'あ行|い行|う行|か行|さ行|た行|な行|は行|ま行|や行|ら行|わ行', content)
print(f"\n=== 50音行テキスト: {rows} ===")
