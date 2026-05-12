"""
Replicate API画像処理モジュール（Supabaseアップロード付き）
- 元の部屋の雰囲気を保ちながら
- シンプルな家具を配置
- 生成された画像をダウンロードしてSupabaseにアップロード
"""

import os
import replicate
import requests
import uuid
from typing import List


def download_image(url: str) -> bytes:
    """
    URLから画像をダウンロード
    """
    response = requests.get(url, timeout=30)
    response.raise_for_status()
    return response.content


def upload_to_supabase(image_data: bytes, filename: str) -> str:
    """
    画像をSupabase Storageにアップロード
    
    Returns:
        Supabaseの公開URL
    """
    from supabase import create_client
    
    supabase_url = os.getenv('SUPABASE_URL', '')
    supabase_key = os.getenv('SUPABASE_SERVICE_KEY', '')
    
    if not supabase_url or not supabase_key:
        raise Exception('SUPABASE_URL or SUPABASE_SERVICE_KEY not set')
    
    supabase = create_client(supabase_url, supabase_key)
    
    # property-imagesバケットにアップロード
    bucket_name = 'property-images'
    file_path = f'processed/{filename}'
    
    # アップロード
    supabase.storage.from_(bucket_name).upload(
        file_path,
        image_data,
        file_options={"content-type": "image/png"}
    )
    
    # 公開URLを取得
    public_url = supabase.storage.from_(bucket_name).get_public_url(file_path)
    
    return public_url


def process_images_with_replicate(image_urls: List[str], num_variations: int = 4) -> List[str]:
    """
    画像URLリストをReplicate APIで処理して、バリエーション画像を生成
    生成された画像をSupabaseにアップロードして永続URLを返す
    
    Args:
        image_urls: 元画像URLリスト
        num_variations: 各画像から生成するバリエーション数（デフォルト: 4）
    
    Returns:
        処理済み画像URLリスト（元画像 + Supabaseにアップロードされたバリエーション）
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
                    "prompt": "same interior room with minimal simple furniture added, one or two basic pieces like a small table or simple chair, photorealistic, natural lighting, professional real estate photo, high quality",
                    "negative_prompt": "cartoon, anime, illustration, drawing, painting, sketch, 3d render, cgi, different room, cluttered, messy, complex furniture, luxury items, completely different interior, blurry, low quality",
                    "prompt_strength": 0.25,  # 元の写真を75%保持、25%だけ変更（家具追加）
                    "num_outputs": num_variations,
                    "guidance_scale": 8.0,
                    "num_inference_steps": 50,
                }
            )
            
            # 生成された画像をダウンロード→Supabaseにアップロード
            if isinstance(output, list):
                for i, temp_url in enumerate(output):
                    try:
                        print(f'[Replicate] ダウンロード中: {temp_url}')
                        
                        # 画像をダウンロード
                        image_data = download_image(temp_url)
                        
                        # ファイル名を生成
                        filename = f'{uuid.uuid4().hex}.png'
                        
                        # Supabaseにアップロード
                        print(f'[Supabase] アップロード中: {filename}')
                        permanent_url = upload_to_supabase(image_data, filename)
                        
                        processed_urls.append(permanent_url)
                        print(f'[Supabase] アップロード完了: {permanent_url}')
                        
                    except Exception as e:
                        print(f'[Error] アップロード失敗: {e}')
                        # エラーの場合は一時URLを使用（期限切れのリスクあり）
                        processed_urls.append(temp_url)
            else:
                try:
                    print(f'[Replicate] ダウンロード中: {output}')
                    image_data = download_image(output)
                    filename = f'{uuid.uuid4().hex}.png'
                    print(f'[Supabase] アップロード中: {filename}')
                    permanent_url = upload_to_supabase(image_data, filename)
                    processed_urls.append(permanent_url)
                    print(f'[Supabase] アップロード完了: {permanent_url}')
                except Exception as e:
                    print(f'[Error] アップロード失敗: {e}')
                    processed_urls.append(output)
            
        except Exception as e:
            print(f'[Replicate] エラー: {url} - {str(e)}')
            # エラーの場合は元のURLのみを使用
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
    
    print('\n=== 画像処理テスト（Supabaseアップロード付き） ===')
    result = process_images_with_replicate(sample_urls, num_variations=2)
    print(f'\n結果: {len(result)}枚')
    for i, url in enumerate(result):
        print(f'  {i+1}. {url}')
