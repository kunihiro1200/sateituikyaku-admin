"""
福岡市 R8（2026年4月1日）通学区域PDF 構造化テキスト抽出
PyMuPDF (fitz) を使用 - 位置情報から列を判定
"""
import sys
import os
import json
import re
import fitz  # PyMuPDF

def extract_layout_text(pdf_path):
    """PDFから位置情報付きテキストを抽出する"""
    doc = fitz.open(pdf_path)
    pages_data = []
    
    for page_num in range(doc.page_count):
        page = doc[page_num]
        # Get text as blocks with position info
        blocks = page.get_text("blocks")
        # Each block: (x0, y0, x1, y1, text, block_no, block_type)
        text_blocks = [(b[0], b[1], b[4].strip()) for b in blocks if b[6] == 0 and b[4].strip()]
        pages_data.append(text_blocks)
    
    doc.close()
    return pages_data

def extract_words_by_column(pdf_path):
    """PDFから単語を列ごとに分類して抽出"""
    doc = fitz.open(pdf_path)
    print(f"ページ数: {doc.page_count}")
    
    all_lines = []
    
    for page_num in range(doc.page_count):
        page = doc[page_num]
        # dict format gives full layout info
        page_dict = page.get_text("dict")
        
        for block in page_dict.get("blocks", []):
            if block.get("type") != 0:  # text blocks only
                continue
            for line in block.get("lines", []):
                spans = line.get("spans", [])
                if not spans:
                    continue
                text = ' '.join(s["text"] for s in spans).strip()
                if not text:
                    continue
                x0 = line["bbox"][0]
                y0 = line["bbox"][1]
                all_lines.append((page_num, y0, x0, text))
    
    doc.close()
    # Sort by page, then y (top to bottom), then x (left to right)
    all_lines.sort(key=lambda l: (l[0], l[1]))
    return all_lines

def analyze_columns(all_lines, page_width=595):
    """x座標から列番号を推定する"""
    # 一般的なA4 PDFは595pt幅
    # 大まかな列境界を設定（学校別一覧表の場合）
    # col0: 小学校名 (x < 150), col1: 中学校名 (150 <= x < 280), 
    # col2: 町名 (280 <= x < 380), col3: 区域 (x >= 380)
    pass

def analyze_gakkoubetsu(pdf_path):
    """学校別通学区域一覧を解析"""
    print("=== 学校別PDF 列構造分析 ===")
    doc = fitz.open(pdf_path)
    
    # 最初の2ページを詳細分析
    for page_num in range(min(3, doc.page_count)):
        print(f"\n--- Page {page_num + 1} ---")
        page = doc[page_num]
        page_dict = page.get_text("dict")
        
        # Collect all text with x coordinates
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
        for y, x, text in items[:40]:
            print(f"  y={y:4d} x={x:4d}: {text[:60]}")
    
    doc.close()

def analyze_choumeibetsu(pdf_path):
    """町名別通学区域一覧を解析"""
    print("\n=== 町名別PDF 列構造分析 ===")
    doc = fitz.open(pdf_path)
    
    for page_num in range(min(3, doc.page_count)):
        print(f"\n--- Page {page_num + 1} ---")
        page = doc[page_num]
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
        for y, x, text in items[:50]:
            print(f"  y={y:4d} x={x:4d}: {text[:60]}")
    
    doc.close()

if __name__ == '__main__':
    script_dir = os.path.dirname(os.path.abspath(__file__))
    tmp_dir = os.path.join(script_dir, '..', 'tmp-pdf')
    
    gakkou_pdf = os.path.join(tmp_dir, 'R8gakkoubetu.pdf')
    choumei_pdf = os.path.join(tmp_dir, 'R8choumeibetu.pdf')
    
    analyze_gakkoubetsu(gakkou_pdf)
    analyze_choumeibetsu(choumei_pdf)
