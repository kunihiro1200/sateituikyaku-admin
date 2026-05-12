#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
価格監視システムのテスト用スクリプト
"""

import requests
import json

def test_price_monitor():
    """価格監視システムをテスト"""
    
    print("=== 価格監視システムテスト ===")
    
    # 1. スクレイピングサーバーの動作確認
    print("\n1. スクレイピングサーバーの動作確認")
    scrape_url = "https://sateituikyaku-scrape-server-production.up.railway.app"
    
    try:
        # ヘルスチェック
        health_response = requests.get(f"{scrape_url}/health", timeout=10)
        print(f"   ヘルスチェック: {health_response.status_code}")
        
        # テスト用スクレイピング
        test_url = "https://www.athome.co.jp/kodate/1234567890/"  # テスト用URL
        scrape_response = requests.post(
            f"{scrape_url}/scrape",
            json={"url": test_url},
            timeout=30
        )
        print(f"   スクレイピングテスト: {scrape_response.status_code}")
        
    except Exception as e:
        print(f"   エラー: {e}")
    
    # 2. バックエンドAPIの確認
    print("\n2. バックエンドAPIの確認")
    backend_url = "https://sateituikyaku-admin-backend.vercel.app"
    
    try:
        # 買主データの確認（athome_urlが設定されている買主）
        # 注意: 実際のAPIエンドポイントに合わせて調整が必要
        print("   買主データの確認が必要（手動で確認してください）")
        
    except Exception as e:
        print(f"   エラー: {e}")
    
    # 3. 推奨される確認事項
    print("\n3. 確認すべき事項:")
    print("   ✓ Vercel環境変数でCRON_SECRETが設定されているか")
    print("   ✓ 買主テーブルでathome_urlが設定されている買主がいるか")
    print("   ✓ property_price_historyテーブルにデータが蓄積されているか")
    print("   ✓ Vercel Cronジョブのログを確認")
    print("   ✓ メール送信設定（tenant@ifoo-oita.com）が正しいか")

if __name__ == "__main__":
    test_price_monitor()