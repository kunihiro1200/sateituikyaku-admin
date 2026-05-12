#!/usr/bin/env python3
"""
本物のAI画像生成を使った間取り図作成
OpenAI DALL-E 3またはStable Diffusionを使用
"""

import openai
import replicate
import requests
from PIL import Image
import io
import os
from datetime import datetime
import base64

def generate_with_openai():
    """OpenAI DALL-E 3で間取り図を生成"""
    client = openai.OpenAI()
    
    prompt = """
    Create a beautiful, professional Japanese house floor plan (1st floor) in the style of real estate brochures.
    
    Layout specifications:
    - Living & Dining room: 15 tatami, warm beige color, central large space
    - Kitchen: 7 tatami, soft green color, connected to dining
    - Japanese room (和室): 8 tatami, light green color with tatami texture
    - Western room (洋室): 10 tatami, soft blue color
    - Bathroom (浴室): light blue color
    - Toilet (トイレ): light purple color
    - Entrance (玄関): soft pink color
    - Stairs (階段): light gray color
    - Closets (クローゼット): light yellow color, marked "CL"
    - Storage (納戸): light pink color
    
    Style requirements:
    - Soft, natural architectural illustration style
    - Warm, inviting colors like watercolor painting
    - Clean but organic lines, not too geometric
    - Japanese text labels in clear, readable font
    - Room sizes in red numbers (畳)
    - North arrow compass symbol
    - Professional real estate presentation quality
    - Natural lighting and subtle shadows
    - Hand-drawn architectural sketch feeling
    - Cozy, residential atmosphere
    
    Reference style: Japanese real estate floor plan brochures, architectural presentation drawings
    """
    
    try:
        print("🎨 OpenAI DALL-E 3で間取り図を生成中...")
        
        response = client.images.generate(
            model="dall-e-3",
            prompt=prompt,
            size="1792x1024",
            quality="hd",
            n=1
        )
        
        image_url = response.data[0].url
        print(f"✅ 画像URL取得: {image_url}")
        
        # 画像をダウンロード
        image_response = requests.get(image_url)
        image = Image.open(io.BytesIO(image_response.content))
        
        filename = f"openai_floor_plan_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
        image.save(filename, 'PNG', dpi=(300, 300))
        
        print(f"✅ OpenAI生成間取り図: {filename}")
        return filename
        
    except Exception as e:
        print(f"❌ OpenAI生成エラー: {e}")
        return None

def generate_with_replicate():
    """Replicate Stable Diffusionで間取り図を生成"""
    
    prompt = """
    architectural floor plan, Japanese house 1st floor, professional real estate style,
    beautiful watercolor illustration, soft organic shapes, warm inviting colors,
    living room 15 tatami warm beige, kitchen 7 tatami soft green, Japanese room 8 tatami light green,
    western room 10 tatami soft blue, bathroom light blue, toilet light purple,
    entrance soft pink, stairs light gray, closets light yellow,
    Japanese text labels, room numbers in red, north arrow,
    hand-drawn architectural sketch style, natural lighting, cozy atmosphere,
    real estate brochure quality, professional presentation
    """
    
    negative_prompt = """
    ugly, blurry, low quality, distorted, messy, dark colors, harsh lighting,
    overly geometric, CAD drawing, technical blueprint, cold atmosphere,
    western style only, cluttered, unprofessional, sketchy lines
    """
    
    try:
        print("🎨 Replicate Stable Diffusionで間取り図を生成中...")
        
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
        
        if output and len(output) > 0:
            image_url = output[0]
            print(f"✅ Replicate画像URL取得: {image_url}")
            
            image_response = requests.get(image_url)
            image = Image.open(io.BytesIO(image_response.content))
            
            filename = f"replicate_floor_plan_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
            image.save(filename, 'PNG', dpi=(300, 300))
            
            print(f"✅ Replicate生成間取り図: {filename}")
            return filename
        else:
            print("❌ Replicate: 画像生成に失敗")
            return None
            
    except Exception as e:
        print(f"❌ Replicate生成エラー: {e}")
        return None

def generate_multiple_styles():
    """複数のAIスタイルで間取り図を生成"""
    
    styles = [
        {
            "name": "水彩画風",
            "prompt": """watercolor architectural floor plan, Japanese house, soft brush strokes, 
                        natural colors bleeding, artistic illustration, warm atmosphere, 
                        living room, kitchen, bedrooms, bathroom, Japanese text labels""",
            "seed": 123
        },
        {
            "name": "手描きスケッチ風", 
            "prompt": """hand-drawn architectural sketch, Japanese house floor plan, 
                        pencil and watercolor, organic lines, natural imperfections,
                        warm residential feeling, room labels in Japanese, cozy atmosphere""",
            "seed": 456
        },
        {
            "name": "プロフェッショナル風",
            "prompt": """professional architectural presentation, Japanese house floor plan,
                        real estate brochure style, clean illustration, warm colors,
                        living dining kitchen bedrooms, Japanese text, inviting atmosphere""",
            "seed": 789
        }
    ]
    
    results = []
    
    for style in styles:
        try:
            print(f"🎨 {style['name']}スタイルで生成中...")
            
            output = replicate.run(
                "stability-ai/stable-diffusion:ac732df83cea7fff18b8472768c88ad041fa750ff7682a21affe81863cbe77e4",
                input={
                    "prompt": style["prompt"],
                    "negative_prompt": "ugly, blurry, low quality, harsh colors, geometric",
                    "width": 1024,
                    "height": 768,
                    "num_inference_steps": 50,
                    "guidance_scale": 7.5,
                    "seed": style["seed"]
                }
            )
            
            if output and len(output) > 0:
                image_url = output[0]
                image_response = requests.get(image_url)
                image = Image.open(io.BytesIO(image_response.content))
                
                filename = f"ai_{style['name']}_{datetime.now().strftime('%H%M%S')}.png"
                image.save(filename, 'PNG', dpi=(300, 300))
                
                print(f"✅ {style['name']}: {filename}")
                results.append(filename)
            
        except Exception as e:
            print(f"❌ {style['name']}生成エラー: {e}")
    
    return results

def main():
    print("🤖 本物のAI画像生成で間取り図を作成します！")
    
    # OpenAI APIキーの確認
    openai_key = os.getenv('OPENAI_API_KEY')
    replicate_token = os.getenv('REPLICATE_API_TOKEN')
    
    results = []
    
    # OpenAI DALL-E 3を試す
    if openai_key and openai_key != "sk-proj-your-key-here":
        openai_result = generate_with_openai()
        if openai_result:
            results.append(openai_result)
    else:
        print("⚠️ OpenAI APIキーが設定されていません")
    
    # Replicate Stable Diffusionを試す
    if replicate_token:
        replicate_result = generate_with_replicate()
        if replicate_result:
            results.append(replicate_result)
        
        # 複数スタイルも生成
        style_results = generate_multiple_styles()
        results.extend(style_results)
    else:
        print("⚠️ Replicate APIトークンが設定されていません")
    
    if results:
        print(f"\n🎉 AI生成完了！{len(results)}個の間取り図を生成しました:")
        for i, filename in enumerate(results, 1):
            print(f"{i}. {filename}")
        
        print("\n🎨 これらは本物のAI画像生成による間取り図です！")
        print("参考画像のような自然で美しいスタイルになっているはずです。")
    else:
        print("\n❌ AI画像生成に失敗しました。APIキーを確認してください。")

if __name__ == "__main__":
    main()