"""
福岡市通学区域 完全ルックアップテーブル生成スクリプト

取得するページ（中学校ページ：中学校+小学校+住所の対応表）:
  ac = あ行中学校   kc = か行中学校   sc = さ行中学校
  tc = た行中学校   nc = な行中学校   hc = は行中学校
  mc = ま行中学校   yc = や～わ行中学校

小学校ページ（住所ベースの小学校のみ一覧）:
  as, ks, ss, ts, ns, hs, ms, ys → 必要に応じて追加

出力: backend/src/data/fukuoka-school-address-map.json
  { "records": [ { "juniorHigh": "春吉中学校", "elementary": "玉川小学校", "ward": "南区", "town": "玉川町", "range": "全域" }, ... ] }
"""

import urllib.request
import time
import json
import re
from html.parser import HTMLParser

BASE = "http://www.city.fukuoka.lg.jp/kyoiku-iinkai/tsuugaku/ed/area"

# 取得する中学校ページ（中学校+小学校+住所の対応表）
JH_PAGES = ['ac', 'kc', 'sc', 'tc', 'nc', 'hc', 'mc', 'yc']
# 小学校のみのページ（小学校校区は中学校ページからも取得できるが念のため）
ELEM_PAGES = ['as', 'ks', 'ss', 'ts', 'ns', 'hs', 'ms', 'ys', 'ws', 'rs']

class TableParser(HTMLParser):
    """rowspan対応HTMLテーブルパーサー"""
    def __init__(self):
        super().__init__()
        self.rows = []           # 最終的な行データ（rowspan展開済み）
        self._raw_rows = []      # 生の行データ
        self._current_row = []
        self._current_cell = ""
        self._in_td = False
        self._current_rowspan = 1

    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        if tag == "tr":
            self._current_row = []
        elif tag in ("td", "th"):
            self._in_td = True
            self._current_cell = ""
            self._current_rowspan = int(attrs_dict.get("rowspan", 1))

    def handle_endtag(self, tag):
        if tag == "tr":
            if self._current_row:
                self._raw_rows.append(self._current_row[:])
            self._current_row = []
        elif tag in ("td", "th"):
            self._current_row.append({
                "text": self._current_cell.strip(),
                "rowspan": self._current_rowspan,
            })
            self._in_td = False

    def handle_data(self, data):
        if self._in_td:
            self._current_cell += data

    def handle_entityref(self, name):
        if self._in_td:
            entities = {"nbsp": " ", "amp": "&", "lt": "<", "gt": ">", "quot": '"'}
            self._current_cell += entities.get(name, "")

    def handle_charref(self, name):
        if self._in_td:
            try:
                if name.startswith('x'):
                    self._current_cell += chr(int(name[1:], 16))
                else:
                    self._current_cell += chr(int(name))
            except:
                pass

    def get_flat_rows(self):
        """rowspan展開済みのフラットな行リストを返す（各行は文字列リスト）"""
        if not self._raw_rows:
            return []
        
        # 最大列数を取得
        max_cols = max(
            sum(cell["rowspan"] for cell in row)
            for row in self._raw_rows
            if row
        ) if self._raw_rows else 6
        max_cols = min(max_cols, 8)
        
        # rowspan展開
        # pending_cells: {col_index: (text, remaining_rows)}
        flat = []
        pending: dict = {}
        
        for raw_row in self._raw_rows:
            row_cells = []
            raw_idx = 0
            
            for col in range(max_cols):
                if col in pending and pending[col][1] > 0:
                    # rowspan継続セル
                    row_cells.append(pending[col][0])
                    pending[col] = (pending[col][0], pending[col][1] - 1)
                    if pending[col][1] == 0:
                        del pending[col]
                elif raw_idx < len(raw_row):
                    cell = raw_row[raw_idx]
                    row_cells.append(cell["text"])
                    if cell["rowspan"] > 1:
                        pending[col] = (cell["text"], cell["rowspan"] - 1)
                    raw_idx += 1
                else:
                    row_cells.append("")
            
            flat.append(row_cells)
        
        return flat

def fetch_page(code):
    url = f"{BASE}/tsugaku-{code}.html"
    try:
        req = urllib.request.Request(url)
        req.add_header("User-Agent", "Mozilla/5.0")
        with urllib.request.urlopen(req, timeout=15) as r:
            content = r.read().decode("utf-8", errors="ignore")
        print(f"  ✅ {url} ({len(content)} bytes)")
        return content
    except Exception as e:
        print(f"  ❌ {url}: {e}")
        return None

def parse_table(html):
    """rowspan対応パーサーで (中学校, 小学校, 区名, 町名, 区域, 備考) を抽出"""
    parser = TableParser()
    parser.feed(html)
    flat_rows = parser.get_flat_rows()
    
    records = []
    current_jh = ""
    current_elem = ""
    current_ward = ""
    current_town = ""
    
    for row in flat_rows:
        if len(row) < 4: continue
        # ヘッダー行をスキップ
        if row[0] in ("中学校", "小学校", "区名", "町名", "区域", "備考"): continue
        
        jh   = row[0].strip() if row[0].strip() else current_jh
        elem = row[1].strip() if row[1].strip() else current_elem
        ward = row[2].strip() if row[2].strip() else current_ward
        town = row[3].strip() if row[3].strip() else current_town
        rng  = row[4].strip() if len(row) > 4 else ""
        note = row[5].strip() if len(row) > 5 else ""
        
        # 有効なデータのみ追加
        if not (jh and elem and ward and town): continue
        
        current_jh   = jh
        current_elem = elem
        current_ward = ward
        current_town = town
        
        records.append({
            "juniorHigh": jh,
            "elementary": elem,
            "ward": ward,
            "town": town,
            "range": rng,
            "note": note,
        })
    
    return records

def main():
    all_records = []
    
    print("=== 中学校ページ取得（住所対応表の主要データ）===")
    for code in JH_PAGES:
        html = fetch_page(code)
        if html:
            records = parse_table(html)
            all_records.extend(records)
            print(f"    → {len(records)}件")
        time.sleep(0.5)
    
    # 重複排除（town + range + jh + elem でユニーク）
    seen = set()
    unique_records = []
    for r in all_records:
        key = (r["juniorHigh"], r["elementary"], r["ward"], r["town"], r["range"])
        if key not in seen:
            seen.add(key)
            unique_records.append(r)
    
    print(f"\n合計 {len(unique_records)} 件（重複除去後）")
    
    # 件数統計
    juniorhighs = set(r["juniorHigh"] for r in unique_records)
    elementaries = set(r["elementary"] for r in unique_records)
    towns = set(r["town"] for r in unique_records)
    print(f"中学校: {len(juniorhighs)}校")
    print(f"小学校: {len(elementaries)}校")
    print(f"町名: {len(towns)}件")
    
    # 玉川町のデータを確認
    tamagawa = [r for r in unique_records if r["town"] == "玉川町"]
    print(f"\n=== 玉川町の校区データ ===")
    for r in tamagawa:
        print(f"  {r['elementary']} / {r['juniorHigh']} : {r['range']}")
    
    # 出力
    out_path = r"C:\Users\kunih\sateituikyaku-admin\backend\src\data\fukuoka-school-address-map.json"
    result = {
        "version": "2025-12-26",
        "source": "https://www.city.fukuoka.lg.jp/kyoiku-iinkai/tsuugaku/ed/area/",
        "recordCount": len(unique_records),
        "records": unique_records
    }
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    
    size_kb = len(json.dumps(result, ensure_ascii=False)) / 1024
    print(f"\n✅ 保存完了: {out_path}")
    print(f"   ファイルサイズ: {size_kb:.1f}KB")

main()
