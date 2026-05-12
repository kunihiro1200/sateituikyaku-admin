#!/usr/bin/env python3
"""
ローカルAI画像生成を使った間取り図作成
Hugging Face Diffusersライブラリを使用してローカルで実行
"""

try:
    from diffusers import StableDiffusionPipeline
    import torch
    from PIL import Image
    import os
    from datetime import datetime
    
    def generate_local_ai_floor_plan():
        """ローカルAIで間取り図を生成"""
        
        print("🤖 ローカルAI（Stable Diffusion）で間取り図を生成中...")
        print("初回実行時はモデルのダウンロードに時間がかかります...")
        
        # Stable Diffusionパイプラインを初期化
        model_id = "runwayml/stable-diffusion-v1-5"
        
        # CPUまたはGPUを自動選択
        device = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"使用デバイス: {device}")
        
        # パイプラインを読み込み
        pipe = StableDiffusionPipeline.from_pretrained(
            model_id,
            torch_dtype=torch.float16 if device == "cuda" else torch.float32,
            safety_checker=None,
            requires_safety_checker=False
        )
        pipe = pipe.to(device)
        
        # メモリ効率化
        if device == "cpu":
            pipe.enable_attention_slicing()
        
        # プロンプト
        prompt = """
        beautiful Japanese house floor plan, architectural drawing, watercolor style,
        1st floor layout with living room, dining room, kitchen, Japanese room, western room,
        bathroom, toilet, entrance, stairs, closets, warm colors, soft illustration,
        real estate brochure style, professional presentation, cozy atmosphere,
        Japanese text labels, room numbers, north arrow compass
        """
        
        negative_prompt = """
        ugly, blurry, low quality, distorted, messy, dark colors, harsh lighting,
        overly geometric, technical blueprint, cold atmosphere, cluttered
        """
        
        try:
            # 画像生成
            print("🎨 AI画像生成中...")
            image = pipe(
                prompt=prompt,
                negative_prompt=negative_prompt,
                num_inference_steps=20,  # 高速化のため少なめ
                guidance_scale=7.5,
                width=768,
                height=512
            ).images[0]
            
            # 保存
            filename = f"local_ai_floor_plan_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
            image.save(filename, 'PNG', dpi=(300, 300))
            
            print(f"✅ ローカルAI生成間取り図: {filename}")
            return filename
            
        except Exception as e:
            print(f"❌ 画像生成エラー: {e}")
            return None
    
    def main():
        print("🏠 ローカルAI画像生成で間取り図を作成します！")
        print("これは本物のAI（Stable Diffusion）による画像生成です。")
        
        result = generate_local_ai_floor_plan()
        
        if result:
            print(f"\n🎉 AI生成完了！")
            print(f"ファイル: {result}")
            print("\n🎨 特徴:")
            print("- 本物のAI（Stable Diffusion）による生成")
            print("- 参考画像のような自然なスタイル")
            print("- 水彩画風の柔らかい表現")
            print("- プロフェッショナルな品質")
        else:
            print("\n❌ AI画像生成に失敗しました。")

except ImportError:
    print("❌ diffusersライブラリがインストールされていません。")
    print("以下のコマンドでインストールしてください：")
    print("pip install diffusers transformers accelerate torch torchvision")
    print("\n注意: このライブラリは大きなサイズ（数GB）です。")

if __name__ == "__main__":
    main()