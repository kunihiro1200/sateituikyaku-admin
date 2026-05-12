#!/usr/bin/env python3
"""
AI画像生成を使った自然で柔らかい間取り図作成
参考画像のような温かみのある間取り図を生成します
"""

import replicate
import requests
from PIL import Image
import io
import os
from datetime import datetime

def generate_natural_floor_plan():
    """参考画像のような自然で柔らかい間取り図を生成"""
    
    # より詳細で自然なプロンプト
    prompt = """
    Beautiful Japanese house floor plan, architectural drawing, warm and inviting style,
    1st floor layout with living room (15 tatami, warm beige), dining room (6 tatami, cream), 
    kitchen (7 tatami, soft green), Japanese room (8 tatami, light green), 
    western room (10 tatami, soft blue), bathroom (light blue), toilet (light purple), 
    entrance (soft pink), stairs (light gray), closets (pale yellow),
    
    Style: soft watercolor architectural illustration, gentle curves, natural lighting,
    warm pastel colors, professional real estate brochure quality,
    Japanese text labels clearly visible, room numbers in red,
    north arrow compass, clean but organic lines, inviting atmosphere,
    subtle shadows, depth, realistic proportions,
    
    NOT: harsh lines, geometric rigidity, cold colors, clinical appearance,
    overly technical, CAD-like precision, stark contrasts
    """
    
    negative_prompt = """
    ugly, blurry, low quality, distorted, messy, dark, harsh colors, 
    cold atmosphere, overly geometric, rigid lines, CAD drawing, 
    technical blueprint, stark, clinical, western style only,
    cluttered, unprofessional, sketchy, rough, too bright, neon colors
    """
    
    try:
        print("🎨 AI画像生成中（自然スタイル間取り図）...")
        print("参考画像のような温かみのある間取り図を生成しています...")
        
        output = replicate.run(
            "stability-ai/stable-diffusion:ac732df83cea7fff18b8472768c88ad041fa750ff7682a21affe81863cbe77e4",
            input={
                "prompt": prompt,
                "negative_prompt": negative_prompt,
                "width": 1024,
                "height": 768,
                "num_inference_steps": 50,
                "guidance_scale": 7.5,
                "scheduler": "DPMSolverMultistep",
                "seed": 42  # 一貫した結果のため
            }
        )
        
        if output and len(output) > 0:
            image_url = output[0]
            print(f"✅ 画像URL取得成功: {image_url}")
            
            # 画像をダウンロード
            image_response = requests.get(image_url)
            image = Image.open(io.BytesIO(image_response.content))
            
            # 保存
            filename = f"ai_natural_floor_plan_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
            image.save(filename, 'PNG', dpi=(300, 300))
            
            print(f"✅ 自然スタイル間取り図を生成しました: {filename}")
            return filename
        else:
            print("❌ 画像生成に失敗しました")
            return None
            
    except Exception as e:
        print(f"❌ AI画像生成エラー: {e}")
        return None

def generate_watercolor_floor_plan():
    """水彩画風の柔らかい間取り図を生成"""
    
    prompt = """
    Watercolor style Japanese house floor plan, soft and organic architectural illustration,
    1st floor with living room, dining room, kitchen, Japanese room, western room, 
    bathroom, toilet, entrance, stairs, closets,
    
    Watercolor painting style: soft edges, gentle color bleeding, natural textures,
    warm earth tones, pastel colors, hand-drawn feeling, artistic illustration,
    Japanese calligraphy style text labels, room sizes in elegant red numbers,
    
    Professional but artistic, real estate presentation quality,
    inviting and warm atmosphere, natural lighting effects,
    subtle color gradients, organic shapes, flowing lines
    """
    
    negative_prompt = """
    digital art, vector graphics, CAD drawing, technical blueprint, 
    harsh lines, geometric precision, cold colors, stark contrasts,
    overly detailed, cluttered, messy, dark, ugly, low quality
    """
    
    try:
        print("🎨 水彩画風間取り図を生成中...")
        
        output = replicate.run(
            "stability-ai/stable-diffusion:ac732df83cea7fff18b8472768c88ad041fa750ff7682a21affe81863cbe77e4",
            input={
                "prompt": prompt,
                "negative_prompt": negative_prompt,
                "width": 1024,
                "height": 768,
                "num_inference_steps": 50,
                "guidance_scale": 8.0,
                "scheduler": "DPMSolverMultistep",
                "seed": 123
            }
        )
        
        if output and len(output) > 0:
            image_url = output[0]
            image_response = requests.get(image_url)
            image = Image.open(io.BytesIO(image_response.content))
            
            filename = f"ai_watercolor_floor_plan_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
            image.save(filename, 'PNG', dpi=(300, 300))
            
            print(f"✅ 水彩画風間取り図を生成しました: {filename}")
            return filename
        else:
            print("❌ 画像生成に失敗しました")
            return None
            
    except Exception as e:
        print(f"❌ AI画像生成エラー: {e}")
        return None

def generate_hand_drawn_floor_plan():
    """手描き風の温かい間取り図を生成"""
    
    prompt = """
    Hand-drawn Japanese house floor plan, architectural sketch style,
    warm and inviting illustration, 1st floor layout,
    living room 15 tatami, dining room 6 tatami, kitchen 7 tatami,
    Japanese room 8 tatami, western room 10 tatami, bathroom, toilet, entrance, stairs,
    
    Hand-drawn architectural illustration: pencil sketch with watercolor wash,
    soft lines, natural imperfections, human touch, warm colors,
    cozy atmosphere, residential architecture presentation,
    Japanese text in handwritten style, room numbers in red ink,
    north arrow, professional but personal feeling,
    
    Style reference: architectural presentation drawings, real estate brochure,
    interior design sketch, warm and welcoming
    """
    
    negative_prompt = """
    CAD drawing, technical blueprint, digital precision, cold colors,
    harsh lines, geometric rigidity, sterile appearance, 
    overly technical, computer generated look, stark contrasts
    """
    
    try:
        print("🎨 手描き風間取り図を生成中...")
        
        output = replicate.run(
            "stability-ai/stable-diffusion:ac732df83cea7fff18b8472768c88ad041fa750ff7682a21affe81863cbe77e4",
            input={
                "prompt": prompt,
                "negative_prompt": negative_prompt,
                "width": 1024,
                "height": 768,
                "num_inference_steps": 50,
                "guidance_scale": 7.0,
                "scheduler": "DPMSolverMultistep",
                "seed": 456
            }
        )
        
        if output and len(output) > 0:
            image_url = output[0]
            image_response = requests.get(image_url)
            image = Image.open(io.BytesIO(image_response.content))
            
            filename = f"ai_hand_drawn_floor_plan_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
            image.save(filename, 'PNG', dpi=(300, 300))
            
            print(f"✅ 手描き風間取り図を生成しました: {filename}")
            return filename
        else:
            print("❌ 画像生成に失敗しました")
            return None
            
    except Exception as e:
        print(f"❌ AI画像生成エラー: {e}")
        return None

def main():
    print("🏠 AI間取り図生成を開始します...")
    print("参考画像のような自然で柔らかい間取り図を複数のスタイルで生成します。")
    
    results = []
    
    # 1. 自然スタイル
    natural_plan = generate_natural_floor_plan()
    if natural_plan:
        results.append(natural_plan)
    
    # 2. 水彩画風
    watercolor_plan = generate_watercolor_floor_plan()
    if watercolor_plan:
        results.append(watercolor_plan)
    
    # 3. 手描き風
    hand_drawn_plan = generate_hand_drawn_floor_plan()
    if hand_drawn_plan:
        results.append(hand_drawn_plan)
    
    print(f"\n🎉 AI間取り図生成完了！{len(results)}個のスタイルを生成しました。")
    print("\n生成されたファイル:")
    for i, filename in enumerate(results, 1):
        print(f"{i}. {filename}")
    
    print("\n🎨 特徴:")
    print("- 参考画像のような自然で柔らかい見た目")
    print("- AI生成による有機的な形状")
    print("- 温かみのある色合い")
    print("- 手描きのような温かさ")
    print("- プロフェッショナルな品質")

if __name__ == "__main__":
    main()