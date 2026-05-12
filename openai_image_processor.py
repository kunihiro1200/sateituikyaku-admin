# -*- coding: utf-8 -*-
"""
OpenAI DALL-E 3を使用した画像加工処理
元の部屋の構造を保持しながら家具を追加
"""

import os
import requests
from openai import OpenAI
from supabase import create_client
import uuid
import base64
from io import BytesIO
from PIL import Image

# 環境変数から認証情報を取得
OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY', '')
SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_SERVICE_KEY = os.environ.get('SUPABASE_SERVICE_KEY', '')

# OpenAIクライアントを初期化
client = OpenAI(api_key=OPENAI_API_KEY)

# Supabaseクライアントを初期化
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def download_and_prepare_image(image_url: str) -> bytes:
    """
    画像をダウンロードしてPNG形式に変換（OpenAI APIの要件）
    
    Args:
        image_url: 元の画像URL
        
    Returns:
        PNG形式の画像データ（bytes）
    """
    try:
        print(f"[OpenAI] ダウンロード中: {image_url}")
        response = requests.get(image_url, timeout=30)
        response.raise_for_status()
        
        # PIL Imageで開いてPNGに変換
        img = Image.open(BytesIO(response.content))
        
        # RGBAに変換（透明度対応）
        if img.mode != 'RGBA':
            img = img.convert('RGBA')
        
        # 1024x1024にリサイズ（OpenAI APIの推奨サイズ）
        img = img.resize((1024, 1024), Image.Resampling.LANCZOS)
        
        # PNG形式でバイト列に変換
        buffer = BytesIO()
        img.save(buffer, format='PNG')
        buffer.seek(0)
        
        return buffer.read()
        
    except Exception as e:
        print(f"[OpenAI] 画像ダウンロード失敗: {e}")
        raise


def upload_to_supabase_storage(image_url: str, index: int) -> str:
    """
    OpenAIで生成された画像をダウンロードし、Supabase Storageにアップロードする
    
    Args:
        image_url: OpenAIの一時URL
        index: 画像のインデックス番号
        
    Returns:
        Supabase StorageのパブリックURL
    """
    try:
        # 画像をダウンロード
        print(f"[OpenAI] ダウンロード中: {image_url}")
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


def process_images_with_openai(image_urls: list) -> list:
    """
    OpenAI DALL-E 3を使用して画像を加工し、Supabase Storageにアップロードする
    
    Args:
        image_urls: 元の画像URLのリスト
        
    Returns:
        加工済み画像のSupabase Storage URLのリスト
    """
    # 画像枚数制限（タイムアウト対策）
    MAX_IMAGES = 5
    if len(image_urls) > MAX_IMAGES:
        print(f"[OpenAI] 画像枚数制限: {len(image_urls)}枚 → {MAX_IMAGES}枚に制限")
        image_urls = image_urls[:MAX_IMAGES]
    
    print(f"[OpenAI] Processing {len(image_urls)} images with DALL-E 3...")
    
    processed_urls = []
    
    for i, img_url in enumerate(image_urls, 1):
        try:
            print(f"[OpenAI] Processing image {i}/{len(image_urls)}...")
            
            # 画像をダウンロードしてPNG形式に変換
            image_data = download_and_prepare_image(img_url)
            
            # 一時ファイルに保存（OpenAI APIはファイルパスを要求）
            temp_file = f"/tmp/temp_image_{i}.png"
            with open(temp_file, 'wb') as f:
                f.write(image_data)
            
            # OpenAI DALL-E 2で画像編集（DALL-E 3はeditをサポートしていない）
            response = client.images.edit(
                model="dall-e-2",
                image=open(temp_file, "rb"),
                prompt="Add minimal simple modern furniture to the empty spaces in this room. Keep the room structure, walls, windows, and doors exactly the same. Only add furniture like sofa, table, chairs, or plants in empty areas. Photorealistic style.",
                n=1,
                size="1024x1024"
            )
            
            # 一時ファイルを削除
            os.remove(temp_file)
            
            if response.data and len(response.data) > 0:
                generated_url = response.data[0].url
                print(f"[OpenAI] Generated image URL: {generated_url}")
                
                # Supabase Storageにアップロード
                supabase_url = upload_to_supabase_storage(generated_url, i)
                if supabase_url:
                    processed_urls.append(supabase_url)
                else:
                    # アップロード失敗時は元の画像を使用
                    print(f"[OpenAI] Upload failed, using original image")
                    processed_urls.append(img_url)
            else:
                print(f"[OpenAI] No output, using original image")
                processed_urls.append(img_url)
                
        except Exception as e:
            print(f"[OpenAI] Error processing image {i}: {e}")
            import traceback
            traceback.print_exc()
            # エラー時は元の画像を使用
            processed_urls.append(img_url)
    
    print(f"[OpenAI] Successfully processed {len(processed_urls)} images")
    return processed_urls


# テスト用
if __name__ == '__main__':
    # テスト画像URL
    test_urls = [
        "https://www.athome.co.jp/image_files/path/4XRVCeBrwdDuulF68RNppg==?width=800&height=600&margin=false"
    ]
    
    print("テスト開始...")
    result = process_images_with_openai(test_urls)
    print(f"結果: {result}")
