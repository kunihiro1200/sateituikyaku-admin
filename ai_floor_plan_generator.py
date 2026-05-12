#!/usr/bin/env python3
"""
AI画像生成を使った自然な間取り図作成スクリプト
OpenAI DALL-E 3を使用して、参考画像のような柔らかい間取り図を生成します
"""

import openai
import requests
from PIL import Image
import io
import os
from datetime import datetime

class AIFloorPlanGenerator:
    def __init__(self):
        # OpenAI APIキーを設定
        self.client = openai.OpenAI(
            api_key=os.getenv('OPENAI_API_KEY')
        )
        
    def generate_floor_plan_1f(self):
        """1階の間取り図をAI生成"""
        prompt = """
        Create a beautiful, colorful Japanese house floor plan (1st floor) with the following specifications:
        
        Layout:
        - Living & Dining room (リビング・ダイニング): 15 tatami, large central space, warm beige/orange color
        - Kitchen (キッチン): 7 tatami, light green color, connected to dining
        - Japanese room (和室): 8 tatami, light green color, traditional tatami pattern
        - Western room (洋室): 10 tatami, light blue color
        - Bathroom (浴室): light blue color
        - Toilet (トイレ): light purple color
        - Entrance (玄関): light red/pink color
        - Stairs (階段): light gray color
        - Closets (クローゼット): light yellow color, marked as "CL"
        - Storage (納戸): light pink color
        
        Style requirements:
        - Soft, natural colors like the reference image
        - Clean architectural drawing style
        - Japanese text labels in large, clear font
        - Room sizes in red numbers (畳)
        - North arrow compass
        - Professional architectural presentation
        - Smooth, rounded corners where appropriate
        - Natural lighting and shadows
        - High quality, detailed illustration
        
        The overall feeling should be warm, inviting, and professional like a real estate brochure.
        """
        
        try:
            print("🎨 AI画像生成中（1階間取り図）...")
            response = self.client.images.generate(
                model="dall-e-3",
                prompt=prompt,
                size="1792x1024",  # 横長サイズ
                quality="hd",
                n=1
            )
            
            # 画像をダウンロード
            image_url = response.data[0].url
            image_response = requests.get(image_url)
            image = Image.open(io.BytesIO(image_response.content))
            
            # 保存
            filename = f"ai_floor_plan_1f_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
            image.save(filename, 'PNG', dpi=(300, 300))
            
            print(f"✅ 1階間取り図を生成しました: {filename}")
            return filename
            
        except Exception as e:
            print(f"❌ AI画像生成エラー: {e}")
            return None
    
    def generate_floor_plan_2f(self):
        """2階の間取り図をAI生成"""
        prompt = """
        Create a beautiful, colorful Japanese house floor plan (2nd floor) with the following specifications:
        
        Layout:
        - Master bedroom (主寝室): 12 tatami, light blue color, large room
        - Child room 1 (子供部屋1): 6 tatami, light blue color
        - Child room 2 (子供部屋2): 6 tatami, light blue color
        - Walk-in closet (WIC): 4 tatami, light yellow color
        - Balcony (バルコニー): light mint green color
        - Stairs (階段): light gray color
        - Regular closets: light yellow color, marked as "CL"
        
        Style requirements:
        - Soft, natural colors like the reference image
        - Clean architectural drawing style
        - Japanese text labels in large, clear font
        - Room sizes in red numbers (畳)
        - North arrow compass
        - Professional architectural presentation
        - Smooth, rounded corners where appropriate
        - Natural lighting and shadows
        - High quality, detailed illustration
        
        The overall feeling should be warm, inviting, and professional like a real estate brochure.
        """
        
        try:
            print("🎨 AI画像生成中（2階間取り図）...")
            response = self.client.images.generate(
                model="dall-e-3",
                prompt=prompt,
                size="1792x1024",  # 横長サイズ
                quality="hd",
                n=1
            )
            
            # 画像をダウンロード
            image_url = response.data[0].url
            image_response = requests.get(image_url)
            image = Image.open(io.BytesIO(image_response.content))
            
            # 保存
            filename = f"ai_floor_plan_2f_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
            image.save(filename, 'PNG', dpi=(300, 300))
            
            print(f"✅ 2階間取り図を生成しました: {filename}")
            return filename
            
        except Exception as e:
            print(f"❌ AI画像生成エラー: {e}")
            return None
    
    def enhance_existing_floor_plan(self, input_image_path):
        """既存の間取り図をAIで美しく変換"""
        prompt = """
        Transform this floor plan into a beautiful, colorful, professional architectural drawing with:
        
        - Soft, natural colors for each room (living: warm beige, kitchen: light green, bedrooms: light blue, etc.)
        - Large, clear Japanese text labels
        - Room sizes in red numbers
        - Professional real estate brochure style
        - Smooth, natural appearance
        - High quality illustration
        - Warm, inviting atmosphere
        
        Keep the same layout but make it much more visually appealing and professional.
        """
        
        try:
            print("🎨 既存間取り図をAI変換中...")
            
            # 画像を読み込み
            with open(input_image_path, "rb") as image_file:
                response = self.client.images.edit(
                    image=image_file,
                    prompt=prompt,
                    size="1024x1024",
                    n=1
                )
            
            # 変換された画像をダウンロード
            image_url = response.data[0].url
            image_response = requests.get(image_url)
            image = Image.open(io.BytesIO(image_response.content))
            
            # 保存
            filename = f"ai_enhanced_floor_plan_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
            image.save(filename, 'PNG', dpi=(300, 300))
            
            print(f"✅ 間取り図を美しく変換しました: {filename}")
            return filename
            
        except Exception as e:
            print(f"❌ AI画像変換エラー: {e}")
            return None

def main():
    # OpenAI APIキーの確認
    if not os.getenv('OPENAI_API_KEY'):
        print("❌ OPENAI_API_KEYが設定されていません。")
        print("環境変数にOpenAI APIキーを設定してください。")
        return
    
    generator = AIFloorPlanGenerator()
    
    print("🏠 AI間取り図生成を開始します...")
    print("参考画像のような自然で美しい間取り図を生成します。")
    
    # 1階の間取り図を生成
    floor_1f = generator.generate_floor_plan_1f()
    
    # 2階の間取り図を生成
    floor_2f = generator.generate_floor_plan_2f()
    
    print("\n🎉 AI間取り図生成完了！")
    print("特徴:")
    print("- 参考画像のような自然で柔らかい見た目")
    print("- プロフェッショナルな不動産ブローシャー風")
    print("- 美しいカラーリング")
    print("- 大きくて読みやすい日本語ラベル")
    print("- 高品質・高解像度")
    
    if floor_1f:
        print(f"- 1階: {floor_1f}")
    if floor_2f:
        print(f"- 2階: {floor_2f}")

if __name__ == "__main__":
    main()