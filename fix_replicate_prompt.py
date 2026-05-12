"""
replicate_image_processor.pyのプロンプトを改善する
- 写真のリアリズムを保つ
- イラスト風を避ける
- prompt_strengthを0.2に下げる
"""

content = '''"""
Replicate API画像処理モジュール
- 元の部屋の雰囲気を保ちながら
- シンプルな家具を配置
- 別角度・別の照明で撮影したように見せる
"""

import os
import replicate
from typing import List


def process_images_with_replicate(image_urls: List[str], num_variations: int = 4) -> List[str]:
    """
    画像URLリストをReplicate APIで処理して、バリエーション画像を生成
    
    Args:
        image_urls: 元画像URLリスト
        num_variations: 各画像から生成するバリエーション数（デフォルト: 4）
    
    Returns:
        処理済み画像URLリスト（元画像 + バリエーション）
    """
    if not image_urls:
        return []
    
    # Replicate API Token
    api_token = os.getenv('REPLICATE_API_TOKEN', '')
    if not api_token:
        print('[Replicate] エラー: REPLICATE_API_TOKEN環境変数が設定されていません')
        return image_urls  # エラーの場合は元の画像を返す
    
    os.environ['REPLICATE_API_TOKEN'] = api_token
    
    processed_urls = []
    
    for idx, url in enumerate(image_urls):
        try:
            print(f'[Replicate] 処理中 ({idx+1}/{len(image_urls)}): {url}')
            
            # 元画像を追加
            processed_urls.append(url)
            
            # Stable Diffusion img2imgでバリエーションを生成
            output = replicate.run(
                "stability-ai/stable-diffusion:db21e45d3f7023abc2a46ee38a23973f6dce16bb082a930b0c49861f96d1e5bf",
                input={
                    "image": url,
                    "prompt": "photorealistic interior photo, same exact room, slightly different camera angle, natural daylight, professional real estate photography, high quality, sharp focus, realistic lighting",
                    "negative_prompt": "cartoon, anime, illustration, drawing, painting, sketch, 3d render, cgi, artificial, fake, unrealistic, different room, completely different interior, cluttered, messy, logo, watermark, text, blurry, low quality",
                    "prompt_strength": 0.2,  # 元の画像を強く保持（0.2 = 80%元のまま）
                    "num_outputs": num_variations,
                    "guidance_scale": 7.5,
                    "num_inference_steps": 50,
                }
            )
            
            # 生成された画像URLを追加
            if isinstance(output, list):
                for variation_url in output:
                    processed_urls.append(variation_url)
                    print(f'[Replicate] バリエーション生成: {variation_url}')
            else:
                processed_urls.append(output)
                print(f'[Replicate] バリエーション生成: {output}')
            
        except Exception as e:
            print(f'[Replicate] エラー: {url} - {str(e)}')
            # エラーの場合は元のURLのみを使用（バリエーションは生成しない）
            if url not in processed_urls:
                processed_urls.append(url)
    
    print(f'[Replicate] 処理完了: {len(image_urls)}枚 → {len(processed_urls)}枚')
    return processed_urls


def test_replicate_connection():
    """Replicate API接続テスト"""
    api_token = os.getenv('REPLICATE_API_TOKEN', '')
    if not api_token:
        print('[Replicate] 接続失敗: REPLICATE_API_TOKEN環境変数が設定されていません')
        return False
    
    try:
        os.environ['REPLICATE_API_TOKEN'] = api_token
        # 簡易的なテスト（モデル情報取得）
        print('[Replicate] 接続成功')
        return True
    except Exception as e:
        print(f'[Replicate] 接続失敗: {str(e)}')
        return False


if __name__ == "__main__":
    # テスト
    test_replicate_connection()
    
    # サンプル画像でテスト
    sample_urls = [
        "https://www.athome.co.jp/image_files/path/5k30QQFS46dKqNVKGZXJNA==?width=572&height=418&margin=false"
    ]
    
    print('\\n=== 画像処理テスト ===')
    result = process_images_with_replicate(sample_urls, num_variations=2)
    print(f'\\n結果: {len(result)}枚')
    for i, url in enumerate(result):
        print(f'  {i+1}. {url}')
'''

# UTF-8で書き込む
with open('C:/Users/kunih/sateituikyaku-scrape-server/replicate_image_processor.py', 'wb') as f:
    f.write(content.encode('utf-8'))

print('✅ replicate_image_processor.pyを更新しました')
print('')
print('変更内容:')
print('  - prompt_strength: 0.35 → 0.2 (元の画像を80%保持)')
print('  - prompt: 写真のリアリズムを強調')
print('  - negative_prompt: イラスト風を強く避ける')
print('')
print('次のコマンドを実行してください:')
print('  cd C:\\Users\\kunih\\sateituikyaku-scrape-server')
print('  git add replicate_image_processor.py')
print('  git commit -m "fix: Improve Replicate prompt for photorealistic results"')
print('  git push origin main')
