# scrape_server.py の save_to_supabase() 関数を修正するパッチ

# 修正前（Cloudinary処理 - 動作しない）:
"""
def save_to_supabase(data: dict, region: str = 'oita', process_images_flag: bool = False) -> str:
    import urllib.request
    slug = uuid.uuid4().hex[:12]
    images = data.get('images', [])
    
    # Cloudinary画像処理
    if process_images_flag and images:
        try:
            print(f"Processing {len(images)} images with Cloudinary...")
            processed_image_urls = cloudinary_process_images(images)  # ← この関数は存在しない！
            images = processed_image_urls
            print(f"Successfully processed {len(processed_image_urls)} images")
        except Exception as e:
            print(f"Error processing images with Cloudinary: {e}")
    
    payload = { ... }
"""

# 修正後（Replicate処理 - 正しい）:
"""
def save_to_supabase(data: dict, region: str = 'oita', process_images_flag: bool = False) -> str:
    import urllib.request
    slug = uuid.uuid4().hex[:12]
    images = data.get('images', [])
    
    # Replicate画像処理
    if process_images_flag and images:
        try:
            print(f"[Replicate] Processing {len(images)} images...")
            from replicate_image_processor import process_images_with_replicate
            processed_image_urls = process_images_with_replicate(images)
            images = processed_image_urls
            print(f"[Replicate] Successfully processed {len(processed_image_urls)} images")
        except Exception as e:
            print(f"[Replicate] Error processing images: {e}")
            import traceback
            traceback.print_exc()
    
    payload = { ... }
"""

print("修正内容:")
print("1. cloudinary_process_images() → process_images_with_replicate() に変更")
print("2. replicate_image_processor モジュールをインポート")
print("3. ログメッセージに [Replicate] プレフィックスを追加")
print("\nこの修正を scrape_server.py に適用してください。")
