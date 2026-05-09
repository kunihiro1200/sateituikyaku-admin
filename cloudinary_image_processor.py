"""
Cloudinary画像処理モジュール
- 画像をCloudinaryにアップロード
- ロゴ削除・角度変更を適用
"""

import os
import cloudinary
import cloudinary.uploader
import cloudinary.api
from typing import List, Dict
import hashlib

# Cloudinary設定
cloudinary.config(
    cloud_name=os.getenv('CLOUDINARY_CLOUD_NAME'),
    api_key=os.getenv('CLOUDINARY_API_KEY'),
    api_secret=os.getenv('CLOUDINARY_API_SECRET'),
    secure=True
)


def process_images(image_urls: List[str], process_images: bool = False) -> List[str]:
    """
    画像URLリストを処理してCloudinary URLを返す
    
    Args:
        image_urls: 元の画像URLリスト
        process_images: True=ロゴ削除・角度変更を適用、False=そのままアップロード
    
    Returns:
        処理済みCloudinary URLリスト
    """
    if not image_urls:
        return []
    
    processed_urls = []
    
    for idx, url in enumerate(image_urls):
        try:
            # 画像をCloudinaryにアップロード
            # URLのハッシュをpublic_idとして使用（重複アップロード防止）
            url_hash = hashlib.md5(url.encode()).hexdigest()
            public_id = f"tateuri/{url_hash}"
            
            # アップロード（既に存在する場合はスキップ）
            upload_result = cloudinary.uploader.upload(
                url,
                public_id=public_id,
                overwrite=False,  # 既存の場合は上書きしない
                resource_type="image",
                invalidate=True
            )
            
            # Cloudinary URLを生成
            if process_images:
                # 画像加工あり：ロゴ削除・角度変更・拡大
                processed_url = generate_processed_url(upload_result['public_id'], idx)
            else:
                # 画像加工なし：元のまま
                processed_url = upload_result['secure_url']
            
            processed_urls.append(processed_url)
            print(f"[Cloudinary] 処理完了: {url} -> {processed_url}")
            
        except Exception as e:
            print(f"[Cloudinary] エラー: {url} - {str(e)}")
            # エラーの場合は元のURLを使用
            processed_urls.append(url)
    
    return processed_urls


def generate_processed_url(public_id: str, index: int) -> str:
    """
    画像加工済みURLを生成
    - ロゴ削除（上部15%をクロップ）
    - 角度変更（-3度〜+3度）
    - 拡大（1.1〜1.15倍）
    - 位置調整（右寄り・左寄り・中央など）
    
    Args:
        public_id: CloudinaryのPublic ID
        index: 画像インデックス（バリエーション生成用）
    
    Returns:
        加工済みCloudinary URL
    """
    cloud_name = os.getenv('CLOUDINARY_CLOUD_NAME')
    
    # インデックスに応じてバリエーションを変える
    variations = [
        # 0: 右寄り・少し上・-2度・1.12倍
        {'crop': 'fill', 'gravity': 'north_east', 'width': 1200, 'height': 900, 'angle': -2, 'zoom': 1.12},
        # 1: 左寄り・下気味・+2度・1.10倍
        {'crop': 'fill', 'gravity': 'south_west', 'width': 1200, 'height': 900, 'angle': 2, 'zoom': 1.10},
        # 2: 上から引き気味・+3度・1.15倍
        {'crop': 'fill', 'gravity': 'north', 'width': 1200, 'height': 900, 'angle': 3, 'zoom': 1.15},
        # 3: 右寄り・ほぼ正面・+1度・1.08倍
        {'crop': 'fill', 'gravity': 'east', 'width': 1200, 'height': 900, 'angle': 1, 'zoom': 1.08},
        # 4: 下から寄り気味・-2度・1.13倍
        {'crop': 'fill', 'gravity': 'south', 'width': 1200, 'height': 900, 'angle': -2, 'zoom': 1.13},
        # 5: 左上・-3度・1.11倍
        {'crop': 'fill', 'gravity': 'north_west', 'width': 1200, 'height': 900, 'angle': -3, 'zoom': 1.11},
    ]
    
    variation = variations[index % len(variations)]
    
    # Cloudinary変換URLを生成
    # 1. 上部15%をクロップ（ロゴ削除）
    # 2. 角度変更
    # 3. 拡大
    # 4. 位置調整
    transformations = [
        f"c_{variation['crop']}",
        f"g_{variation['gravity']}",
        f"w_{variation['width']}",
        f"h_{variation['height']}",
        f"a_{variation['angle']}",
        f"z_{variation['zoom']}",
        "y_0.15",  # 上部15%をクロップ（ロゴ削除）
        "q_auto",  # 自動品質調整
        "f_auto",  # 自動フォーマット
    ]
    
    transformation_str = ",".join(transformations)
    
    url = f"https://res.cloudinary.com/{cloud_name}/image/upload/{transformation_str}/{public_id}"
    
    return url


def test_cloudinary_connection():
    """Cloudinary接続テスト"""
    try:
        result = cloudinary.api.ping()
        print("[Cloudinary] 接続成功:", result)
        return True
    except Exception as e:
        print("[Cloudinary] 接続失敗:", str(e))
        return False


if __name__ == "__main__":
    # テスト
    test_cloudinary_connection()
    
    # サンプル画像でテスト
    sample_urls = [
        "https://www.athome.co.jp/ahcs/kodate.html?BKKN=001234567890&SHBKN=0012345678901",
    ]
    
    print("\n=== 加工なしテスト ===")
    result1 = process_images(sample_urls, process_images=False)
    print("結果:", result1)
    
    print("\n=== 加工ありテスト ===")
    result2 = process_images(sample_urls, process_images=True)
    print("結果:", result2)
