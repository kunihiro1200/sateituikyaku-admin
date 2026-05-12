#!/usr/bin/env python3
"""
カラフルで見やすい間取り図を手動で作成するスクリプト
アップロードされた間取り図を参考に、分かりやすい間取り図を生成します
"""

from PIL import Image, ImageDraw, ImageFont
import numpy as np

class ColorfulFloorPlanCreator:
    def __init__(self, width=1200, height=800):
        self.width = width
        self.height = height
        
        # カラーパレット
        self.colors = {
            'wall': (80, 80, 80),           # 壁：濃いグレー
            'living': (255, 230, 180),      # リビング：薄いオレンジ
            'dining': (255, 240, 200),      # ダイニング：薄いベージュ
            'kitchen': (180, 255, 180),     # キッチン：薄い緑
            'bedroom': (200, 220, 255),     # 寝室：薄い青
            'japanese_room': (220, 255, 220), # 和室：薄い緑
            'bathroom': (180, 240, 255),    # 浴室：薄い水色
            'toilet': (240, 180, 255),      # トイレ：薄い紫
            'closet': (255, 255, 180),      # クローゼット：薄い黄色
            'entrance': (255, 180, 180),    # 玄関：薄い赤
            'balcony': (180, 255, 230),     # バルコニー：薄いミント
            'stairs': (220, 220, 220),      # 階段：薄いグレー
            'storage': (255, 200, 255),     # 納戸：薄いピンク
        }
        
        # テキストの色
        self.text_color = (0, 0, 0)         # 黒
        self.size_text_color = (255, 0, 0)  # 赤（畳数表示用）
        
    def create_floor_plan(self):
        """1階の間取り図を作成"""
        # 白い背景の画像を作成
        image = Image.new('RGB', (self.width, self.height), 'white')
        draw = ImageDraw.Draw(image)
        
        # フォント設定
        try:
            font_large = ImageFont.truetype("arial.ttf", 36)
            font_medium = ImageFont.truetype("arial.ttf", 28)
            font_small = ImageFont.truetype("arial.ttf", 20)
        except:
            font_large = ImageFont.load_default()
            font_medium = ImageFont.load_default()
            font_small = ImageFont.load_default()
        
        # 外壁を描画
        wall_thickness = 8
        draw.rectangle([50, 50, self.width-50, self.height-50], 
                      outline=self.colors['wall'], width=wall_thickness)
        
        # 各部屋を描画（アップロードされた間取り図を参考）
        
        # 1. リビング・ダイニング（L15）
        living_rect = [200, 300, 700, 650]
        draw.rectangle(living_rect, fill=self.colors['living'], 
                      outline=self.colors['wall'], width=3)
        draw.text((400, 450), "リビング・ダイニング", fill=self.text_color, font=font_large)
        draw.text((450, 490), "15畳", fill=self.size_text_color, font=font_medium)
        
        # 2. キッチン（K7）
        kitchen_rect = [70, 400, 200, 550]
        draw.rectangle(kitchen_rect, fill=self.colors['kitchen'], 
                      outline=self.colors['wall'], width=3)
        draw.text((100, 460), "キッチン", fill=self.text_color, font=font_medium)
        draw.text((120, 490), "7畳", fill=self.size_text_color, font=font_small)
        
        # 3. ダイニング（D6）
        dining_rect = [200, 200, 400, 300]
        draw.rectangle(dining_rect, fill=self.colors['dining'], 
                      outline=self.colors['wall'], width=3)
        draw.text((250, 240), "ダイニング", fill=self.text_color, font=font_medium)
        draw.text((280, 270), "6畳", fill=self.size_text_color, font=font_small)
        
        # 4. 和室（和8）
        japanese_room_rect = [700, 300, 950, 500]
        draw.rectangle(japanese_room_rect, fill=self.colors['japanese_room'], 
                      outline=self.colors['wall'], width=3)
        draw.text((750, 380), "和室", fill=self.text_color, font=font_large)
        draw.text((780, 420), "8畳", fill=self.size_text_color, font=font_medium)
        
        # 5. 洋室（洋10）
        western_room_rect = [700, 500, 950, 720]
        draw.rectangle(western_room_rect, fill=self.colors['bedroom'], 
                      outline=self.colors['wall'], width=3)
        draw.text((750, 590), "洋室", fill=self.text_color, font=font_large)
        draw.text((780, 630), "10畳", fill=self.size_text_color, font=font_medium)
        
        # 6. 浴室
        bathroom_rect = [70, 200, 200, 300]
        draw.rectangle(bathroom_rect, fill=self.colors['bathroom'], 
                      outline=self.colors['wall'], width=3)
        draw.text((100, 240), "浴室", fill=self.text_color, font=font_medium)
        
        # 7. トイレ
        toilet_rect = [70, 300, 150, 400]
        draw.rectangle(toilet_rect, fill=self.colors['toilet'], 
                      outline=self.colors['wall'], width=3)
        draw.text((85, 340), "トイレ", fill=self.text_color, font=font_small)
        
        # 8. 玄関
        entrance_rect = [400, 100, 600, 200]
        draw.rectangle(entrance_rect, fill=self.colors['entrance'], 
                      outline=self.colors['wall'], width=3)
        draw.text((450, 140), "玄関", fill=self.text_color, font=font_medium)
        
        # 9. 階段
        stairs_rect = [500, 200, 600, 300]
        draw.rectangle(stairs_rect, fill=self.colors['stairs'], 
                      outline=self.colors['wall'], width=3)
        draw.text((520, 240), "階段", fill=self.text_color, font=font_medium)
        
        # 10. クローゼット（複数）
        closet1_rect = [950, 300, 1050, 400]
        draw.rectangle(closet1_rect, fill=self.colors['closet'], 
                      outline=self.colors['wall'], width=3)
        draw.text((960, 340), "CL", fill=self.text_color, font=font_small)
        
        closet2_rect = [950, 500, 1050, 600]
        draw.rectangle(closet2_rect, fill=self.colors['closet'], 
                      outline=self.colors['wall'], width=3)
        draw.text((960, 540), "CL", fill=self.text_color, font=font_small)
        
        # 11. 納戸
        storage_rect = [950, 400, 1100, 500]
        draw.rectangle(storage_rect, fill=self.colors['storage'], 
                      outline=self.colors['wall'], width=3)
        draw.text((970, 440), "納戸", fill=self.text_color, font=font_medium)
        
        # 方位記号を追加
        self.draw_compass(draw, 1050, 150, font_medium)
        
        # タイトルを追加
        draw.text((50, 20), "1階間取り図（カラー版）", fill=self.text_color, font=font_large)
        
        return image
    
    def draw_compass(self, draw, x, y, font):
        """方位記号を描画"""
        # 円を描画
        radius = 30
        draw.ellipse([x-radius, y-radius, x+radius, y+radius], 
                    outline=self.colors['wall'], width=2)
        
        # 北の矢印
        draw.polygon([(x, y-radius+5), (x-8, y-10), (x+8, y-10)], 
                    fill=self.colors['wall'])
        
        # N の文字
        draw.text((x-8, y-radius-20), "N", fill=self.text_color, font=font)
    
    def create_2f_floor_plan(self):
        """2階の間取り図を作成"""
        # 白い背景の画像を作成
        image = Image.new('RGB', (self.width, self.height), 'white')
        draw = ImageDraw.Draw(image)
        
        # フォント設定
        try:
            font_large = ImageFont.truetype("arial.ttf", 36)
            font_medium = ImageFont.truetype("arial.ttf", 28)
            font_small = ImageFont.truetype("arial.ttf", 20)
        except:
            font_large = ImageFont.load_default()
            font_medium = ImageFont.load_default()
            font_small = ImageFont.load_default()
        
        # 外壁を描画
        wall_thickness = 8
        draw.rectangle([50, 50, self.width-50, self.height-50], 
                      outline=self.colors['wall'], width=wall_thickness)
        
        # 2階の部屋を描画（推測）
        
        # 主寝室
        master_bedroom_rect = [200, 200, 600, 500]
        draw.rectangle(master_bedroom_rect, fill=self.colors['bedroom'], 
                      outline=self.colors['wall'], width=3)
        draw.text((350, 330), "主寝室", fill=self.text_color, font=font_large)
        draw.text((380, 370), "12畳", fill=self.size_text_color, font=font_medium)
        
        # 子供部屋1
        child_room1_rect = [600, 200, 900, 400]
        draw.rectangle(child_room1_rect, fill=self.colors['bedroom'], 
                      outline=self.colors['wall'], width=3)
        draw.text((700, 280), "子供部屋1", fill=self.text_color, font=font_medium)
        draw.text((730, 320), "6畳", fill=self.size_text_color, font=font_small)
        
        # 子供部屋2
        child_room2_rect = [600, 400, 900, 600]
        draw.rectangle(child_room2_rect, fill=self.colors['bedroom'], 
                      outline=self.colors['wall'], width=3)
        draw.text((700, 480), "子供部屋2", fill=self.text_color, font=font_medium)
        draw.text((730, 520), "6畳", fill=self.size_text_color, font=font_small)
        
        # 階段
        stairs_rect = [500, 200, 600, 300]
        draw.rectangle(stairs_rect, fill=self.colors['stairs'], 
                      outline=self.colors['wall'], width=3)
        draw.text((520, 240), "階段", fill=self.text_color, font=font_medium)
        
        # WIC（ウォークインクローゼット）
        wic_rect = [200, 500, 400, 650]
        draw.rectangle(wic_rect, fill=self.colors['closet'], 
                      outline=self.colors['wall'], width=3)
        draw.text((250, 560), "WIC", fill=self.text_color, font=font_medium)
        draw.text((270, 590), "4畳", fill=self.size_text_color, font=font_small)
        
        # バルコニー
        balcony_rect = [900, 200, 1100, 600]
        draw.rectangle(balcony_rect, fill=self.colors['balcony'], 
                      outline=self.colors['wall'], width=3)
        draw.text((930, 380), "バルコニー", fill=self.text_color, font=font_medium)
        
        # 方位記号を追加
        self.draw_compass(draw, 1050, 150, font_medium)
        
        # タイトルを追加
        draw.text((50, 20), "2階間取り図（カラー版）", fill=self.text_color, font=font_large)
        
        return image

def main():
    creator = ColorfulFloorPlanCreator()
    
    # 1階の間取り図を作成
    floor_plan_1f = creator.create_floor_plan()
    floor_plan_1f.save("colorful_floor_plan_1f.png", 'PNG', dpi=(300, 300))
    print("✅ 1階のカラー間取り図を作成しました: colorful_floor_plan_1f.png")
    
    # 2階の間取り図を作成
    floor_plan_2f = creator.create_2f_floor_plan()
    floor_plan_2f.save("colorful_floor_plan_2f.png", 'PNG', dpi=(300, 300))
    print("✅ 2階のカラー間取り図を作成しました: colorful_floor_plan_2f.png")
    
    print("\n🎨 カラフルで見やすい間取り図が完成しました！")
    print("特徴:")
    print("- 各部屋が色分けされています")
    print("- 文字とサイズが大きく表示されています")
    print("- 畳数が赤字で強調されています")
    print("- 方位記号が追加されています")

if __name__ == "__main__":
    main()