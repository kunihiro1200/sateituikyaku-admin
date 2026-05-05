import requests, re

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept-Language': 'ja-JP,ja;q=0.9',
}
r = requests.get('https://www.athome.co.jp/mansion/1194026316/', headers=headers, timeout=15)
print('Status:', r.status_code)
print('Content-Length:', len(r.text))

imgs = re.findall(r'image_files/path/[^\s"\'&]+margin=false', r.text)
print('margin=false画像数:', len(imgs))

title = re.search(r'<title>(.*?)</title>', r.text)
print('タイトル:', title.group(1) if title else 'なし')

lats = list(set(re.findall(r'33\.\d{5,}', r.text)))
print('緯度候補:', lats[:3])
