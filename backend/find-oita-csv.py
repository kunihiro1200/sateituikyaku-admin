import urllib.request
import re

url = "https://www.city.oita.oita.jp/o190/kosodate/shochugakko/1336693333358.html"
req = urllib.request.Request(url)
req.add_header("User-Agent", "Mozilla/5.0")
with urllib.request.urlopen(req, timeout=15) as r:
    content = r.read().decode("utf-8", errors="ignore")

# CSV/Excel リンクを探す
links = re.findall(r"href=[\"']([^\"']+)[\"']", content)
for link in links:
    lower = link.lower()
    if any(ext in lower for ext in [".csv", ".xlsx", ".xls", ".zip", "tsugaku", "school"]):
        print("LINK:", link)

print("\n--- 全リンク（/o190 or file含む）---")
for link in links:
    if "/o190" in link or "download" in link.lower() or "/data" in link or ".csv" in link.lower():
        print(link)
