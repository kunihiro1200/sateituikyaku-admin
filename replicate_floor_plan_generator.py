#!/usr/bin/env python3
"""
Replicateを使った自然な間取り図作成スクリプト
Stable Diffusionを使用して、参考画像のような柔らかい間取り図を生成します
"""

import replicate
import requests
from PIL import Image
import io
import os
from datetime import datetime

class ReplicateFloorPlanGenerator:
    def __init__(self):
        # Replicate APIトークンを設定
        if os.getenv('REPLICATE_API_TOKEN'):
            os.environ['REPLICATE_API_TOKEN'] = os.getenv('REPLICATE_API_TOKEN')
        
    def generate_floor_plan_1f(self):
        """1階の間取り図をAI生成"""
        prompt = """
        architectural floor plan, Japanese house 1st floor, professional real estate style, 
        colorful rooms: living room 15 tatami (warm beige), kitchen 7 tatami (light green), 
        Japanese room 8 tatami (light green), western room 10 tatami (light blue), 
        bathroom (light blue), toilet (light purple), entrance (light pink), 
        stairs (light gray), closets (light yellow), storage (light pink),
        clean lines, soft colors, Japanese text labels, room numbers in red,
        north arrow, professional architectural drawing, warm lighting,
        high quality, detailed, beautiful, inviting atmosphere
        """
        
        negative_prompt = """
        ugly, blurry, low quality, distorted, messy, dark, harsh colors, 
        western style, cluttered, unprofessional, sketchy, rough
        """
        
        try:
            print("🎨 AI画像生成中（1階間取り図）...")
            
            output = replicate.run(
                "stability-ai/stable-diffusion:ac732df83cea7fff18b8472768c88ad041fa750ff7682a21affe81863cbe77e4",
                input={
                    "prompt": prompt,
                    "negative_prompt": negative_prompt,
                    "width": 1024,
                    "height": 768,
                    "num_inference_steps": 50,
                    "guidance_scale": 7.5,
                    "scheduler": "DPMSolverMultistep"
                }
            )
            
            # 画像をダウンロード
            if output and len(output) > 0:
                image_url = output[0]
                image_response = requests.get(image_url)
                image = Image.open(io.BytesIO(image_response.content))
                
                # 保存
                filename = f"replicate_floor_plan_1f_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
                image.save(filename, 'PNG', dpi=(300, 300))
                
                print(f"✅ 1階間取り図を生成しました: {filename}")
                return filename
            else:
                print("❌ 画像生成に失敗しました")
                return None
                
        except Exception as e:
            print(f"❌ AI画像生成エラー: {e}")
            return None
    
    def generate_floor_plan_2f(self):
        """2階の間取り図をAI生成"""
        prompt = """
        architectural floor plan, Japanese house 2nd floor, professional real estate style,
        colorful rooms: master bedroom 12 tatami (light blue), child room 1 6 tatami (light blue),
        child room 2 6 tatami (light blue), walk-in closet 4 tatami (light yellow),
        balcony (light mint green), stairs (light gray), closets (light yellow),
        clean lines, soft colors, Japanese text labels, room numbers in red,
        north arrow, professional architectural drawing, warm lighting,
        high quality, detailed, beautiful, inviting atmosphere
        """
        
        negative_prompt = """
        ugly, blurry, low quality, distorted, messy, dark, harsh colors,
        western style, cluttered, unprofessional, sketchy, rough
        """
        
        try:
            print("🎨 AI画像生成中（2階間取り図）...")
            
            output = replicate.run(
                "stability-ai/stable-diffusion:ac732df83cea7fff18b8472768c88ad041fa750ff7682a21affe81863cbe77e4",
                input={
                    "prompt": prompt,
                    "negative_prompt": negative_prompt,
                    "width": 1024,
                    "height": 768,
                    "num_inference_steps": 50,
                    "guidance_scale": 7.5,
                    "scheduler": "DPMSolverMultistep"
                }
            )
            
            # 画像をダウンロード
            if output and len(output) > 0:
                image_url = output[0]
                image_response = requests.get(image_url)
                image = Image.open(io.BytesIO(image_response.content))
                
                # 保存
                filename = f"replicate_floor_plan_2f_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
                image.save(filename, 'PNG', dpi=(300, 300))
                
                print(f"✅ 2階間取り図を生成しました: {filename}")
                return filename
            else:
                print("❌ 画像生成に失敗しました")
                return None
                
        except Exception as e:
            print(f"❌ AI画像生成エラー: {e}")
            return None
    
    def generate_natural_style_floor_plan(self):
        """参考画像のような自然なスタイルの間取り図を生成"""
        prompt = """
        beautiful Japanese house floor plan, architectural drawing, real estate brochure style,
        1st floor layout with living room, dining room, kitchen, Japanese room, western room,
        bathroom, toilet, entrance, stairs, closets, storage,
        soft pastel colors, warm beige living area, light green kitchen and Japanese room,
        light blue bedrooms, light purple toilet, light pink entrance, light yellow closets,
        professional architectural illustration, clean lines, natural lighting,
        Japanese text labels, room sizes in red numbers, north arrow compass,
        high quality, detailed, inviting, warm atmosphere, real estate photography style
        """
        
        negative_prompt = """
        ugly, blurry, low quality, distorted, messy, dark colors, harsh lighting,
        cluttered, unprofessional, sketchy, rough, western style only, 
        too geometric, too rigid, cold atmosphere
        """
        
        try:
            print("🎨 自然スタイルの間取り図を生成中...")
            
            output = replicate.run(
                "stability-ai/stable-diffusion:ac732df83cea7fff18b8472768c88ad041fa750ff7682a21affe81863cbe77e4",
                input={
                    "prompt": prompt,
                    "negative_prompt": negative_prompt,
                    "width": 1024,
                    "height": 768,
                    "num_inference_steps": 50,
                    "guidance_scale": 7.5,
                    "scheduler": "DPMSolverMultistep"
                }
            )
            
            # 画像をダウンロード
            if output and len(output) > 0:
                image_url = output[0]
                image_response = requests.get(image_url)
                image = Image.open(io.BytesIO(image_response.content))
                
                # 保存
                filename = f"natural_style_floor_plan_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
                image.save(filename, 'PNG', dpi=(300, 300))
                
                print(f"✅ 自然スタイル間取り図を生成しました: {filename}")
                return filename
            else:
                print("❌ 画像生成に失敗しました")
                return None
                
        except Exception as e:
            print(f"❌ AI画像生成エラー: {e}")
            return None

def main():
    # Replicate APIトークンの確認
    if not os.getenv('REPLICATE_API_TOKEN'):
        print("❌ REPLICATE_API_TOKENが設定されていません。")
        print("環境変数にReplicate APIトークンを設定してください。")
        print("または、以下のコマンドで設定してください：")
        print("$env:REPLICATE_API_TOKEN='your_token_here'")
        return
    
    generator = ReplicateFloorPlanGenerator()
    
    print("🏠 AI間取り図生成を開始します...")
    print("参考画像のような自然で美しい間取り図を生成します。")
    
    # 自然スタイルの間取り図を生成
    natural_plan = generator.generate_natural_style_floor_plan()
    
    # 1階の間取り図を生成
    floor_1f = generator.generate_floor_plan_1f()
    
    # 2階の間取り図を生成
    floor_2f = generator.generate_floor_plan_2f()
    
    print("\n🎉 AI間取り図生成完了！")
    print("特徴:")
    print("- 参考画像のような自然で柔らかい見た目")
    print("- プロフェッショナルな不動産ブローシャー風")
    print("- 美しいカラーリング")
    print("- 自然な照明効果")
    print("- 高品質・高解像度")
    
    if natural_plan:
        print(f"- 自然スタイル: {natural_plan}")
    if floor_1f:
        print(f"- 1階: {floor_1f}")
    if floor_2f:
        print(f"- 2階: {floor_2f}")

if __name__ == "__main__":
    main()