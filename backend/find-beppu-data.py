import urllib.request
import re

# 別府市の通学区域ページを探す
urls = [
    "https://www.city.beppu.oita.jp/gakusyuu/gakkou/05tetsuduki_gakkugai.html",
    "https://www.city.beppu.oita.jp/gakusyuu/gakkou/gakko_shogakko.html",
    "https://www.city.beppu.oita.jp/gakusyuu/gakkou/gakko_tyugakko.html",
]

for url in urls:
    try:
        req = urllib.request.Request(url)
        req.add_header("User-Agent", "Mozilla/5.0")
        with urllib.request.urlopen(req, timeout=10) as r:
            content = r.read().decode("utf-8", errors="ignore")
        
        # CSV/Excel/PDFのリンクを探す
        links = re.findall(r"href=[\"']([^\"']+)[\"']", content)
        for link in links:
            if any(ext in link.lower() for ext in [".csv", ".xlsx", ".xls", ".pdf"]):
                print(f"  FILE: {link}")
        
        # 通学区域テキストを探す
        if "通学区域" in content or "校区" in content:
            print(f"  {url}: '通学区域' found")
    except Exception as e:
        print(f"  {url}: ERROR {e}")
