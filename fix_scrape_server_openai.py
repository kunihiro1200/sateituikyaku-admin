# scrape_server.py を OpenAI に切り替えるための修正スクリプト

import re

# 修正内容
print("=" * 60)
print("scrape_server.py の修正内容")
print("=" * 60)

print("""
1. インポート文を変更:

変更前:
    from replicate_image_processor import process_images_with_replicate

変更後:
    from openai_image_processor import process_images_with_openai


2. 関数呼び出しを変更:

変更前:
    processed_image_urls = process_images_with_replicate(images)

変更後:
    processed_image_urls = process_images_with_openai(images)


3. ログメッセージを変更:

変更前:
    print(f"[Replicate] Processing {len(images)} images...")

変更後:
    print(f"[OpenAI] Processing {len(images)} images...")
""")

print("=" * 60)
print("手動で修正する場合:")
print("=" * 60)
print("""
1. C:\\Users\\kunih\\sateituikyaku-scrape-server\\scrape_server.py を開く
2. Ctrl+F で "replicate_image_processor" を検索
3. "openai_image_processor" に置き換え
4. Ctrl+F で "process_images_with_replicate" を検索
5. "process_images_with_openai" に置き換え
6. 保存
""")

print("=" * 60)
print("または、以下のコマンドで自動置換:")
print("=" * 60)
print("""
cd C:\\Users\\kunih\\sateituikyaku-scrape-server

# PowerShellで実行:
(Get-Content scrape_server.py) -replace 'replicate_image_processor', 'openai_image_processor' -replace 'process_images_with_replicate', 'process_images_with_openai' | Set-Content scrape_server.py
""")
