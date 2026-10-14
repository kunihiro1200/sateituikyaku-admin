import urllib.request
import csv
import io

# 大分市 通学区域一覧 CSV (オープンデータ)
csv_url = "https://www.city.oita.oita.jp/o190/kosodate/shochugakko/documents/tugakukuikiopen.csv"
out_path = "C:/Users/kunih/Downloads/oita_school_districts.csv"

req = urllib.request.Request(csv_url)
req.add_header("User-Agent", "Mozilla/5.0")
with urllib.request.urlopen(req, timeout=30) as r:
    data = r.read()
    
with open(out_path, "wb") as f:
    f.write(data)

print("Downloaded: %d bytes" % len(data))

# 文字コードを判定してCSVを読む
for encoding in ["utf-8", "utf-8-sig", "cp932", "shift_jis"]:
    try:
        text = data.decode(encoding)
        reader = csv.reader(io.StringIO(text))
        rows = list(reader)
        print("Encoding: %s, Rows: %d" % (encoding, len(rows)))
        print("Header:", rows[0] if rows else "none")
        print("Sample rows:")
        for row in rows[1:6]:
            print(" ", row)
        break
    except Exception as e:
        print("Failed %s: %s" % (encoding, e))
