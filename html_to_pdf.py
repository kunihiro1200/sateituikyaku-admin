"""
取得書類チェックリスト HTML → PDF & 高解像度PNG 変換スクリプト
使い方: python html_to_pdf.py
出力:
  取得書類チェックリスト.pdf  （PDF版）
  取得書類チェックリスト.png  （高解像度PNG版 300dpi相当 → スプシ貼り付け用）
"""

from pathlib import Path
from playwright.sync_api import sync_playwright

SCRIPT_DIR = Path(__file__).parent
HTML_FILE  = SCRIPT_DIR / "取得書類チェックリスト.html"
PDF_FILE   = SCRIPT_DIR / "取得書類チェックリスト.pdf"
PNG_FILE   = SCRIPT_DIR / "取得書類チェックリスト.png"

# A4サイズ 210mm x 297mm
# 150dpi相当（スプシ貼り付けに十分な解像度、かつファイルサイズ小）
SCALE = 2.0
A4_W_PX = int(794 * SCALE)   # 1588px
A4_H_PX = int(1123 * SCALE)  # 2246px

def convert():
    if not HTML_FILE.exists():
        print(f"[エラー] HTMLファイルが見つかりません: {HTML_FILE}")
        return

    html_url = HTML_FILE.as_uri()

    with sync_playwright() as p:
        browser = p.chromium.launch()

        # ===== PDF生成 =====
        page_pdf = browser.new_page()
        page_pdf.goto(html_url, wait_until="networkidle")
        page_pdf.pdf(
            path=str(PDF_FILE),
            format="A4",
            print_background=True,
            margin={"top": "0", "bottom": "0", "left": "0", "right": "0"},
            scale=1.0,
        )
        page_pdf.close()
        print(f"[完了] PDF: {PDF_FILE}")

        # ===== 高解像度PNG生成 =====
        page_png = browser.new_page(
            viewport={"width": 794, "height": 1123},  # A4を96dpiの論理px
            device_scale_factor=SCALE,                 # HiDPIで実解像度を上げる
        )
        page_png.goto(html_url, wait_until="networkidle")
        page_png.screenshot(
            path=str(PNG_FILE),
            full_page=False,
            # clipは論理px（viewport基準）で指定する
            clip={"x": 0, "y": 0, "width": 794, "height": 1123},
        )
        page_png.close()
        print(f"[完了] PNG: {PNG_FILE}")

        browser.close()

    print("\nスプシへの貼り付けは PNG ファイルを使ってください（高解像度）")

if __name__ == "__main__":
    convert()
