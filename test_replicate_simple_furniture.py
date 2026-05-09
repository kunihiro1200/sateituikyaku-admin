"""
Replicate APIを使った画像加工テスト（シンプルな家具バージョン）
- 元の部屋の雰囲気を保ちながら
- 非常にシンプルな家具を配置
- 複雑な装飾は避ける
"""

import replicate
import os

# Replicate API Token（環境変数から取得）
REPLICATE_API_TOKEN = os.getenv('REPLICATE_API_TOKEN', '')
if not REPLICATE_API_TOKEN:
    print('エラー: REPLICATE_API_TOKEN環境変数が設定されていません')
    print('以下のコマンドで設定してください:')
    print('  export REPLICATE_API_TOKEN="your-token-here"  # Mac/Linux')
    print('  $env:REPLICATE_API_TOKEN="your-token-here"   # Windows PowerShell')
    exit(1)

os.environ['REPLICATE_API_TOKEN'] = REPLICATE_API_TOKEN


def test_simple_furniture_staging(image_url: str):
    """
    シンプルな家具を配置したステージング画像を生成
    """
    print('\n=== シンプルな家具配置テスト ===')
    print(f'元画像: {image_url}')
    
    # Stable Diffusion img2imgを使用
    # prompt_strengthを0.35に下げて、元の部屋をより保持
    output = replicate.run(
        "stability-ai/stable-diffusion:db21e45d3f7023abc2a46ee38a23973f6dce16bb082a930b0c49861f96d1e5bf",
        input={
            "image": image_url,
            "prompt": "same room interior, very minimal simple furniture, one or two basic pieces, clean modern style, natural lighting, professional real estate photo",
            "negative_prompt": "complex furniture, cluttered, decorations, ornate, busy, multiple furniture pieces, completely different room, luxury items, expensive furniture",
            "prompt_strength": 0.35,  # 元の部屋を強く保持
            "num_outputs": 4,  # 4パターン生成
            "guidance_scale": 7.5,
            "num_inference_steps": 50,
        }
    )
    
    print(f'\n生成された画像（{len(output)}枚）:')
    for i, url in enumerate(output):
        print(f'{i+1}. {url}')
    
    return output


if __name__ == '__main__':
    # テスト用の画像URL
    test_image_url = "https://www.athome.co.jp/image_files/path/5k30QQFS46dKqNVKGZXJNA==?width=572&height=418&margin=false"
    
    print('=== Replicate API - シンプルな家具配置テスト ===')
    print(f'画像URL: {test_image_url}')
    print('処理を開始します...\n')
    
    try:
        result_urls = test_simple_furniture_staging(test_image_url)
        
        print('\n=== テスト完了 ===')
        print('生成された画像を確認してください:')
        for i, url in enumerate(result_urls):
            print(f'  パターン{i+1}: {url}')
        
        print('\n各URLをブラウザで開いて確認してください。')
        print('気に入ったパターンがあれば教えてください！')
        
    except Exception as e:
        print(f'\nエラーが発生しました: {e}')
        import traceback
        traceback.print_exc()
