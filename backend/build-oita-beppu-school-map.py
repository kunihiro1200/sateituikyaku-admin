"""
大分市・別府市 通学区域ルックアップテーブル生成スクリプト

大分市: 公式CSV (46KB) → 町名 → 中学校 + 小学校
別府市: 公式Excel → 町名 → 中学校 + 小学校

出力: backend/src/data/oita-beppu-school-address-map.json
"""
import csv
import io
import json
import re
import warnings
warnings.filterwarnings("ignore")

# ---- 全角→半角 数字変換 ----
def to_half(s):
    return s.translate(str.maketrans("０１２３４５６７８９", "0123456789"))

def normalize_town(name):
    if not name:
        return ""
    s = str(name).strip()
    s = to_half(s)
    return s

records = []

# ============================================================
# 大分市 CSV
# ============================================================
with open("C:/Users/kunih/Downloads/oita_school_districts.csv", "rb") as f:
    raw = f.read()

text = raw.decode("cp932", errors="ignore")
reader = csv.reader(io.StringIO(text))
rows = list(reader)

print("大分市 CSV: %d rows" % len(rows))
header = rows[0]
print("Header:", header)

for row in rows[1:]:
    if len(row) < 3:
        continue
    town_raw  = row[0].strip()
    jh_name   = row[1].strip()
    elem_name = row[2].strip()
    
    if not town_raw or not jh_name or not elem_name:
        continue
    
    # 全角数字を半角に
    town_norm = normalize_town(town_raw)
    
    records.append({
        "city": "大分市",
        "town": town_norm,
        "elementary": elem_name,
        "juniorHigh": jh_name,
        "note": "",
    })

print("大分市レコード: %d件" % len([r for r in records if r["city"] == "大分市"]))

# ============================================================
# 別府市 Excel
# ============================================================
import openpyxl
wb = openpyxl.load_workbook("C:/Users/kunih/Downloads/beppu_tuugaku2.xlsx")
ws = wb["R8"]

beppu_count = 0
for i, row in enumerate(ws.iter_rows(min_row=3, values_only=True)):
    # 左側テーブル: Col 1=町名, Col 4=小学校, Col 6=中学校
    # 右側テーブル: Col 9=町名, Col 12=小学校, Col 14=中学校
    for town_idx, elem_idx, jh_idx in [(1, 4, 6), (9, 12, 14)]:
        if len(row) <= jh_idx:
            continue
        town_raw  = row[town_idx]
        elem_name = row[elem_idx]
        jh_name   = row[jh_idx]
        
        if not town_raw or not elem_name or not jh_name:
            continue
        
        town_norm = normalize_town(str(town_raw))
        
        records.append({
            "city": "別府市",
            "town": town_norm,
            "elementary": str(elem_name).strip(),
            "juniorHigh": str(jh_name).strip(),
            "note": "",
        })
        beppu_count += 1

print("別府市レコード: %d件" % beppu_count)

# ============================================================
# 出力
# ============================================================
out_path = "C:/Users/kunih/sateituikyaku-admin/backend/src/data/oita-beppu-school-address-map.json"
result = {
    "version": "2025-2026",
    "sources": {
        "大分市": "https://www.city.oita.oita.jp/o190/kosodate/shochugakko/documents/tugakukuikiopen.csv (令和7年4月現在)",
        "別府市": "https://www.city.beppu.oita.jp/doc/gakusyuu/gakkou/05tetsuduki/tuugaku2.xlsx (令和8年度版)"
    },
    "recordCount": len(records),
    "records": records,
}

with open(out_path, "w", encoding="utf-8") as f:
    json.dump(result, f, ensure_ascii=False, indent=2)

size_kb = len(json.dumps(result, ensure_ascii=False)) / 1024
print("\n✅ 保存完了: %s" % out_path)
print("   %d件, %.1fKB" % (len(records), size_kb))

# サンプル確認
print("\n大分市 サンプル:")
for r in [r for r in records if r["city"] == "大分市"][:5]:
    print("  %s → %s / %s" % (r["town"], r["elementary"], r["juniorHigh"]))

print("\n別府市 サンプル:")
for r in [r for r in records if r["city"] == "別府市"][:5]:
    print("  %s → %s / %s" % (r["town"], r["elementary"], r["juniorHigh"]))

# アドレス検索テスト
def lookup(city, town_in_address):
    town_norm = normalize_town(town_in_address)
    hits = [r for r in records if r["city"] == city and r["town"] == town_norm]
    if hits:
        return hits[0]
    # 前方一致（丁目なし）
    hits = [r for r in records if r["city"] == city and r["town"].startswith(town_norm)]
    if hits:
        return hits[0]
    return None

print("\n=== 検索テスト ===")
tests = [
    ("大分市", "上野丘1丁目"),
    ("大分市", "顕徳町"),
    ("大分市", "稙田"),
    ("別府市", "青山町"),
    ("別府市", "朝見一丁目"),
    ("別府市", "楠町"),
]
for city, town in tests:
    r = lookup(city, town)
    if r:
        print("  ✅ %s %s → %s / %s" % (city, town, r["elementary"], r["juniorHigh"]))
    else:
        print("  ❌ %s %s: 見つからず" % (city, town))
