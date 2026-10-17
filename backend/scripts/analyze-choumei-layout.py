"""
町名別 PDF の列構造を複数ページで詳細分析する
"""
import fitz
import os

def get_items(pdf_path, pages=(1, 2, 3, 4, 5)):
    doc = fitz.open(pdf_path)
    result = {}
    for pg in pages:
        if pg >= doc.page_count:
            continue
        page = doc[pg]
        page_dict = page.get_text("dict")
        items = []
        for block in page_dict.get("blocks", []):
            if block.get("type") != 0:
                continue
            for line in block.get("lines", []):
                spans = line.get("spans", [])
                if not spans:
                    continue
                text = ''.join(s["text"] for s in spans).strip()
                if not text:
                    continue
                x0 = round(line["bbox"][0])
                y0 = round(line["bbox"][1])
                items.append((y0, x0, text))
        items.sort()
        result[pg+1] = items
    doc.close()
    return result

script_dir = os.path.dirname(os.path.abspath(__file__))
tmp_dir = os.path.join(script_dir, '..', 'tmp-pdf')
choumei_pdf = os.path.join(tmp_dir, 'R8choumeibetu.pdf')

pages_data = get_items(choumei_pdf, pages=range(1, 6))

for pg, items in pages_data.items():
    print(f"\n=== Page {pg} (最初の50行) ===")
    for y, x, text in items[:50]:
        print(f"  y={y:4d} x={x:3d}: {text[:70]}")
