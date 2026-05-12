#!/usr/bin/env python3
"""
Replicate APIキーのテストスクリプト
"""

import replicate
import os

def test_replicate_api():
    """Replicate APIキーをテスト"""
    
    # APIキーの確認
    api_token = os.getenv('REPLICATE_API_TOKEN')
    
    if not api_token:
        print("❌ REPLICATE_API_TOKENが設定されていません")
        print("\n📋 設定方法:")
        print("1. https://replicate.com でアカウント作成")
        print("2. Account settings → API tokens → Create token")
        print("3. 以下のコマンドで設定:")
        print('   $env:REPLICATE_API_TOKEN = "r8_your_actual_key_here"')
        return False
    
    if api_token == "r8_YOUR_ACTUAL_API_KEY_HERE":
        print("❌ プレースホルダーのAPIキーが設定されています")
        print("実際のAPIキーに置き換えてください")
        return False
    
    print(f"✅ APIキーが設定されています: {api_token[:10]}...")
    
    # 簡単なテスト実行
    try:
        print("🧪 APIキーをテスト中...")
        
        # 軽量なモデルでテスト
        output = replicate.run(
            "stability-ai/stable-diffusion:ac732df83cea7fff18b8472768c88ad041fa750ff7682a21affe81863cbe77e4",
            input={
                "prompt": "simple house floor plan",
                "width": 512,
                "height": 512,
                "num_inference_steps": 10,  # 高速テスト
                "guidance_scale": 7.5
            }
        )
        
        if output:
            print("✅ APIキーが正常に動作しています！")
            print(f"テスト画像URL: {output[0] if output else 'なし'}")
            return True
        else:
            print("❌ 画像生成に失敗しました")
            return False
            
    except Exception as e:
        print(f"❌ APIテストエラー: {e}")
        
        if "401" in str(e) or "Unauthenticated" in str(e):
            print("\n🔑 認証エラー:")
            print("- APIキーが間違っている可能性があります")
            print("- Replicateアカウントでキーを再確認してください")
        elif "429" in str(e) or "rate limit" in str(e):
            print("\n⏰ レート制限エラー:")
            print("- 無料プランの制限に達しています")
            print("- 少し待ってから再試行してください")
        
        return False

if __name__ == "__main__":
    print("🔑 Replicate APIキーテスト")
    test_replicate_api()