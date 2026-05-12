"""
scrape_server.pyをUTF-8で正しく修正する
Cloudinary処理をReplicate処理に置き換える
"""

# 元のファイルを読み込む（UTF-8）
with open('C:/Users/kunih/sateituikyaku-scrape-server/scrape_server.py', 'rb') as f:
    content = f.read()

# UTF-8でデコード
text = content.decode('utf-8')

# Cloudinaryのインポートをコメントアウト
text = text.replace(
    'from cloudinary_image_processor import process_images as cloudinary_process_images',
    '# Cloudinary処理は使用しない（Replicate APIを使用）'
)

# Cloudinary処理をReplicate処理に置き換え
old_cloudinary_code = '''    # Cloudinary画像処理
    if process_images_flag and images:
        try:
            print(f"Processing {len(images)} images with Cloudinary...")
            processed_image_urls = cloudinary_process_images(images)
            images = processed_image_urls
            print(f"Successfully processed {len(processed_image_urls)} images")
        except Exception as e:
            print(f"Error processing images with Cloudinary: {e}")'''

new_replicate_code = '''    # Replicate API画像処理
    if process_images_flag and images:
        print(f'[scrape] 画像処理開始: {len(images)}枚')
        try:
            from replicate_image_processor import process_images_with_replicate
            images = process_images_with_replicate(images, num_variations=4)
            print(f'[scrape] 画像処理完了: {len(images)}枚')
        except Exception as e:
            print(f'[scrape] 画像処理エラー: {e}')
            # エラーの場合は元の画像を使用
            images = data.get('images', [])'''

text = text.replace(old_cloudinary_code, new_replicate_code)

# UTF-8で書き込む（BOMなし）
with open('C:/Users/kunih/sateituikyaku-scrape-server/scrape_server.py', 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ scrape_server.pyを修正しました（UTF-8）')
print('次のコマンドを実行してください：')
print('  cd C:\\Users\\kunih\\sateituikyaku-scrape-server')
print('  git add scrape_server.py')
print('  git commit -m "fix: Replace Cloudinary with Replicate API (UTF-8 safe)"')
print('  git push origin main')
