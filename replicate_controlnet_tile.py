# -*- coding: utf-8 -*-
"""
Replicate ControlNet Tileを使用した画像加工処理
元の部屋の構造を保持しながら家具を追加
"""

import os
import requests
import replicate
from supabase import create_client
import uuid

# 環境変数から認証情報を取得
REPLICATE_API_TOKEN = os.environ.get('REPLICATE_API_TOKEN', '')
SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_SERVICE_KEY = os.environ.get('SUPABASE_SERVICE_KEY', '')

# Supabaseクライアントを初期化
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def upload_to_supabase_storage(image_url: str, index: int) -> str:
    """
    Replicateで生成された画像をダウンロードし、Supabase Storageにアップロードする
    
    Args:
        image_url: Replicateの一時URL
        index: 画像のインデックス番号
        
    Returns:
        Supabase StorageのパブリックURL
    """
    try:
        # 画像をダウンロード
        print(f"[Replicate] ダウンロード中: {image_url}")
        response = requests.get(image_url, timeout=30)
        response.raise_for_status()
        image_data = response.content
        
        # ファイル名を生成（ユニークID + インデックス）
        file_id = uuid.uuid4().hex[:12]
        file_name = f"processed/{file_id}-{index}.png"
        
        print(f"[Supabase] アップロード中: {file_name}")
        
        # Supabase Storageにアップロード
        result = supabase.storage.from_('property-images').upload(
            file_name,
            image_data,
            {
                'content-type': 'image/png',
                'cache-control': '3600',
                'upsert': 'false'
            }
        )
        
        # パブリックURLを取得
        public_url = supabase.storage.from_('property-images').get_public_url(file_name)
        
        print(f"[Supabase] アップロード完了: {public_url}")
        return public_url
        
    except Exception as e:
        print(f"[Error] アップロード失敗: {e}")
        import traceback
        traceback.print_exc()
        return None


def process_images_with_controlnet_tile(image_urls: list) -> list:
    """
    Replicate ControlNet Tileを使用して画像を加工し、Supabase Storageにアップロードする
    
    Args:
        image_urls: 元の画像URLのリスト
        
    Returns:
        加工済み画像のSupabase Storage URLのリスト
    """
    # 画像枚数制限（タイムアウト対策）
    MAX_IMAGES = 5
    if len(image_urls) > MAX_IMAGES:
        print(f"[Replicate] 画像枚数制限: {len(image_urls)}枚 → {MAX_IMAGES}枚に制限")
        image_urls = image_urls[:MAX_IMAGES]
    
    print(f"[Replicate] Processing {len(image_urls)} images with ControlNet Tile...")
    
    processed_urls = []
    
    for i, img_url in enumerate(image_urls, 1):
        try:
            print(f"[Replicate] Processing image {i}/{len(image_urls)}...")
            
            # Replicate ControlNet Tileで画像加工
            output = replicate.run(
                "jagilley/controlnet-tile:cd86b36c",
                input={
                    "image": img_url,
                    "prompt": "modern furnished living room with sofa, coffee table, chairs, plants, clean and bright interior, photorealistic, high quality",
                    "negative_prompt": "blurry, distorted, low quality, cartoon, illustration, anime, painting, sketch, unrealistic",
                    "num_outputs": 1,
                    "guidance_scale": 7.5,
                    "controlnet_conditioning_scale": 1.5,  # 元の画像の構造を強く保持
                    "num_inference_steps": 30,
                }
            )
            
            if output and len(output) > 0:
                generated_url = output[0]
                print(f"[Replicate] Generated image URL: {generated_url}")
                
                # Supabase Storageにアップロード
                supabase_url = upload_to_supabase_storage(generated_url, i)
                if supabase_url:
                    processed_urls.append(supabase_url)
                else:
                    # アップロード失敗時は元の画像を使用
                    print(f"[Replicate] Upload failed, using original image")
                    processed_urls.append(img_url)
            else:
                print(f"[Replicate] No output, using original image")
                processed_urls.append(img_url)
                
        except Exception as e:
            print(f"[Replicate] Error processing image {i}: {e}")
            import traceback
            traceback.print_exc()
            # エラー時は元の画像を使用
            processed_urls.append(img_url)
    
    print(f"[Replicate] Successfully processed {len(processed_urls)} images")
    return processed_urls


# テスト用
if __name__ == '__main__':
    # テスト画像URL
    test_urls = [
        "https://www.athome.co.jp/image_files/path/4XRVCeBrwdDuulF68RNppg==?width=800&height=600&margin=false"
    ]
    
    print("テスト開始...")
    result = process_images_with_controlnet_tile(test_urls)
    print(f"結果: {result}")
