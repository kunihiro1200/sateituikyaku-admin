"""
Replicate APIを使った画像加工テスト
- ロゴ検出・削除
- 別角度画像生成
- 写っていない箇所の推測
"""

import replicate
import os
import requests
from PIL import Image
from io import BytesIO

# Replicate API Token（環境変数から取得）
REPLICATE_API_TOKEN = os.getenv('REPLICATE_API_TOKEN', '')

if not REPLICATE_API_TOKEN:
    print('エラー: REPLICATE_API_TOKEN環境変数が設定されていません')
    print('以下のコマンドで設定してください:')
    print('  export REPLICATE_API_TOKEN="your-token-here"  # Mac/Linux')
    print('  $env:REPLICATE_API_TOKEN="your-token-here"   # Windows PowerShell')
    exit(1)

# Replicateクライアント初期化
os.environ['REPLICATE_API_TOKEN'] = REPLICATE_API_TOKEN


def test_logo_removal(image_url: str):
    """
    テスト1: ロゴ検出・削除（Inpainting）
    """
    print('\n=== テスト1: ロゴ検出・削除 ===')
    print(f'元画像: {image_url}')
    
    # Stable Diffusion Inpaintingモデルを使用
    # ロゴ部分を自動検出して削除
    output = replicate.run(
        "stability-ai/stable-diffusion-inpainting:95b7223104132402a9ae91cc677285bc5eb997834bd2349fa486f53910fd68b3",
        input={
            "image": image_url,
            "prompt": "clean interior photo without any logos or text, professional real estate photography",
            "negative_prompt": "logo, text, watermark, company name",
            "num_outputs": 1,
            "guidance_scale": 7.5,
            "num_inference_steps": 50,
        }
    )
    
    result_url = output[0] if isinstance(output, list) else output
    print(f'結果: {result_url}')
    return result_url


def test_angle_variation(image_url: str):
    """
    テスト2: 別角度画像生成（ControlNet）
    """
    print('\n=== テスト2: 別角度画像生成 ===')
    print(f'元画像: {image_url}')
    
    # ControlNet Depthを使用して別角度から見た画像を生成
    output = replicate.run(
        "jagilley/controlnet-depth2img:2e1c5e87c1f8e0c7f8c0c0c0c0c0c0c0",
        input={
            "image": image_url,
            "prompt": "professional real estate interior photo, taken from a different angle, natural lighting",
            "negative_prompt": "blurry, distorted, low quality",
            "num_outputs": 3,  # 3つの異なる角度を生成
            "guidance_scale": 7.5,
            "num_inference_steps": 30,
        }
    )
    
    print(f'結果（{len(output)}枚）:')
    for i, url in enumerate(output):
        print(f'  {i+1}. {url}')
    return output


def test_outpainting(image_url: str):
    """
    テスト3: 写っていない箇所の推測（Outpainting）
    """
    print('\n=== テスト3: 写っていない箇所の推測 ===')
    print(f'元画像: {image_url}')
    
    # Stable Diffusion Outpaintingを使用
    output = replicate.run(
        "stability-ai/stable-diffusion:db21e45d3f7023abc2a46ee38a23973f6dce16bb082a930b0c49861f96d1e5bf",
        input={
            "image": image_url,
            "prompt": "expand the image to show more of the room, professional real estate photography",
            "negative_prompt": "blurry, distorted",
            "width": 1024,
            "height": 768,
            "num_outputs": 1,
        }
    )
    
    result_url = output[0] if isinstance(output, list) else output
    print(f'結果: {result_url}')
    return result_url


def download_and_display(url: str, filename: str):
    """画像をダウンロードして保存"""
    response = requests.get(url)
    img = Image.open(BytesIO(response.content))
    img.save(filename)
    print(f'保存: {filename}')


if __name__ == '__main__':
    # テスト用の画像URL（athomeの物件ページURLまたは画像URL）
    test_url = input('テストする画像URLまたはathome物件ページURLを入力してください: ').strip()
    
    if not test_url:
        print('エラー: URLが入力されていません')
        exit(1)
    
    # athomeの物件ページURLの場合、画像URLを取得
    if 'athome.co.jp/kodate/' in test_url:
        print(f'\nathome物件ページ: {test_url}')
        print('画像URLを取得中...')
        
        # 簡易的に最初の画像URLを取得
        import re
        response = requests.get(test_url)
        html = response.text
        
        # athomeの画像URLパターンを検索（複数パターンを試す）
        patterns = [
            r'https://www\.athome\.co\.jp/image_files/path/[^"\']+',
            r'image_files/path/[^"\']+',
            r'src="([^"]+image[^"]+)"',
        ]
        
        matches = []
        for pattern in patterns:
            matches = re.findall(pattern, html)
            if matches:
                break
        
        if not matches:
            print('エラー: 画像URLが見つかりませんでした')
            print('代わりに、画像URLを直接入力してください。')
            print('（ブラウザの開発者ツール（F12）→ Elementsタブ → img要素のsrc属性をコピー）')
            exit(1)
        
        # 相対URLの場合は絶対URLに変換
        test_image_url = matches[0]
        if not test_image_url.startswith('http'):
            test_image_url = 'https://www.athome.co.jp/' + test_image_url.lstrip('/')
        
        print(f'取得した画像URL: {test_image_url}')
    else:
        test_image_url = test_url
    
    print(f'\n画像URL: {test_image_url}')
    print('処理を開始します...')
    
    # テスト1: ロゴ削除
    try:
        logo_removed_url = test_logo_removal(test_image_url)
        download_and_display(logo_removed_url, 'test_1_logo_removed.jpg')
    except Exception as e:
        print(f'テスト1失敗: {e}')
    
    # テスト2: 別角度画像生成
    try:
        angle_urls = test_angle_variation(test_image_url)
        for i, url in enumerate(angle_urls):
            download_and_display(url, f'test_2_angle_{i+1}.jpg')
    except Exception as e:
        print(f'テスト2失敗: {e}')
    
    # テスト3: Outpainting
    try:
        outpainted_url = test_outpainting(test_image_url)
        download_and_display(outpainted_url, 'test_3_outpainted.jpg')
    except Exception as e:
        print(f'テスト3失敗: {e}')
    
    print('\n=== テスト完了 ===')
    print('生成された画像を確認してください:')
    print('  - test_1_logo_removed.jpg')
    print('  - test_2_angle_1.jpg, test_2_angle_2.jpg, test_2_angle_3.jpg')
    print('  - test_3_outpainted.jpg')
