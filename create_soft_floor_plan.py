#!/usr/bin/env python3
"""
参考画像のような柔らかくて自然な間取り図作成スクリプト
角を丸くし、グラデーション効果を追加して、より自然な見た目にします
"""

from PIL import Image, ImageDraw, ImageFont, ImageFilter
import numpy as np
import os

class SoftFloorPlanCreator:
    def __init__(self, width=1200, height=800):
        self.width = width
        self.height = height
        
        # より自然で柔らかいカラーパレット（参考画像に近い色）
        self.colors = {
            'wall': (60, 60, 60),               # 壁：濃いグレー
            'living': (255, 235, 200),          # リビング：暖かいベージュ
            'dining': (255, 240, 210),          # ダイニング：薄いクリーム
            'kitchen': (200, 255, 200),         # キッチン：薄い緑
            'bedroom': (220, 235, 255),         # 寝室：薄い青
            'japanese_room': (230, 255, 230),   # 和室：薄い緑
            'bathroom': (200, 245, 255),        # 浴室：薄い水色
            'toilet': (245, 200, 255),          # トイレ：薄い紫
            'closet': (255, 255, 200),          # クローゼット：薄い黄色
            'entrance': (255, 200, 200),        # 玄関：薄いピンク
            'balcony': (200, 255, 240),         # バルコニー：薄いミント
            'stairs': (240, 240, 240),          # 階段：薄いグレー
            'storage': (255, 220, 255),         # 納戸：薄いピンク
        }
        
        # テキストの色
        self.text_color = (40, 40, 40)          # 濃いグレー（黒より柔らか）
        self.size_text_color = (220, 50, 50)   # 赤（少し暗め）
        
        # 日本語フォントを設定
        self.setup_fonts()
        
    def setup_fonts(self):
        """日本語フォントを設定"""
        font_paths = [
            "C:/Windows/Fonts/msgothic.ttc",      # MS ゴシック
            "C:/Windows/Fonts/meiryo.ttc",        # メイリオ
            "C:/Windows/Fonts/yugothm.ttc",       # 游ゴシック Medium
        ]
        
        self.font_large = None
        self.font_medium = None
        self.font_small = None
        
        for font_path in font_paths:
            if os.path.exists(font_path):
                try:
                    self.font_large = ImageFont.truetype(font_path, 32)
                    self.font_medium = ImageFont.truetype(font_path, 24)
                    self.font_small = ImageFont.truetype(font_path, 18)
                    print(f"✅ 日本語フォントを読み込みました: {font_path}")
                    return
                except Exception as e:
                    continue
        
        # デフォルトフォント
        self.font_large = ImageFont.load_default()
        self.font_medium = ImageFont.load_default()
        self.font_small = ImageFont.load_default()
    
    def draw_rounded_rectangle(self, draw, coords, fill_color, outline_color, corner_radius=15, outline_width=2):
        """角丸の四角形を描画"""
        x1, y1, x2, y2 = coords
        
        # 角丸四角形を描画
        # 中央の四角形
        draw.rectangle([x1 + corner_radius, y1, x2 - corner_radius, y2], fill=fill_color)
        draw.rectangle([x1, y1 + corner_radius, x2, y2 - corner_radius], fill=fill_color)
        
        # 四隅の円
        draw.ellipse([x1, y1, x1 + 2*corner_radius, y1 + 2*corner_radius], fill=fill_color)
        draw.ellipse([x2 - 2*corner_radius, y1, x2, y1 + 2*corner_radius], fill=fill_color)
        draw.ellipse([x1, y2 - 2*corner_radius, x1 + 2*corner_radius, y2], fill=fill_color)
        draw.ellipse([x2 - 2*corner_radius, y2 - 2*corner_radius, x2, y2], fill=fill_color)
        
        # アウトライン（簡略化）
        if outline_width > 0:
            draw.rectangle([x1, y1, x2, y2], outline=outline_color, width=outline_width)
    
    def add_subtle_shadow(self, image, room_coords, shadow_offset=3):
        """部屋に微妙な影を追加"""
        shadow_layer = Image.new('RGBA', image.size, (0, 0, 0, 0))
        shadow_draw = ImageDraw.Draw(shadow_layer)
        
        for coords in room_coords:
            x1, y1, x2, y2 = coords
            # 影を少しずらして描画
            shadow_draw.rectangle([x1 + shadow_offset, y1 + shadow_offset, 
                                 x2 + shadow_offset, y2 + shadow_offset], 
                                fill=(0, 0, 0, 30))  # 薄い影
        
        # 影をぼかす
        shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(radius=2))
        
        # 元の画像に影を合成
        image.paste(shadow_layer, (0, 0), shadow_layer)
        return image
    
    def create_soft_floor_plan(self):
        """柔らかい1階の間取り図を作成"""
        # 白い背景の画像を作成
        image = Image.new('RGB', (self.width, self.height), (250, 250, 250))  # 少し灰色がかった白
        draw = ImageDraw.Draw(image)
        
        # 部屋の座標を保存（影用）
        room_coords = []
        
        # 外壁を角丸で描画
        wall_thickness = 6
        self.draw_rounded_rectangle(draw, [40, 40, self.width-40, self.height-40], 
                                  (255, 255, 255), self.colors['wall'], 
                                  corner_radius=20, outline_width=wall_thickness)
        
        # 各部屋を角丸で描画
        
        # 1. リビング・ダイニング（L15）
        living_rect = [180, 280, 680, 630]
        room_coords.append(living_rect)
        self.draw_rounded_rectangle(draw, living_rect, self.colors['living'], 
                                  self.colors['wall'], corner_radius=12, outline_width=2)
        
        # テキスト描画
        if self.font_large != ImageFont.load_default():
            draw.text((350, 430), "リビング・ダイニング", fill=self.text_color, font=self.font_medium)
            draw.text((430, 460), "15畳", fill=self.size_text_color, font=self.font_large)
        else:
            draw.text((320, 430), "Living・Dining", fill=self.text_color, font=self.font_medium)
            draw.text((430, 460), "15", fill=self.size_text_color, font=self.font_large)
        
        # 2. キッチン（K7）
        kitchen_rect = [60, 380, 180, 530]
        room_coords.append(kitchen_rect)
        self.draw_rounded_rectangle(draw, kitchen_rect, self.colors['kitchen'], 
                                  self.colors['wall'], corner_radius=10, outline_width=2)
        
        if self.font_large != ImageFont.load_default():
            draw.text((90, 440), "キッチン", fill=self.text_color, font=self.font_small)
            draw.text((105, 465), "7畳", fill=self.size_text_color, font=self.font_medium)
        else:
            draw.text((90, 440), "Kitchen", fill=self.text_color, font=self.font_small)
            draw.text((110, 465), "7", fill=self.size_text_color, font=self.font_medium)
        
        # 3. ダイニング（D6）
        dining_rect = [180, 180, 380, 280]
        room_coords.append(dining_rect)
        self.draw_rounded_rectangle(draw, dining_rect, self.colors['dining'], 
                                  self.colors['wall'], corner_radius=10, outline_width=2)
        
        if self.font_large != ImageFont.load_default():
            draw.text((230, 220), "ダイニング", fill=self.text_color, font=self.font_small)
            draw.text((260, 245), "6畳", fill=self.size_text_color, font=self.font_medium)
        else:
            draw.text((230, 220), "Dining", fill=self.text_color, font=self.font_small)
            draw.text((260, 245), "6", fill=self.size_text_color, font=self.font_medium)
        
        # 4. 和室（和8）
        japanese_room_rect = [680, 280, 930, 480]
        room_coords.append(japanese_room_rect)
        self.draw_rounded_rectangle(draw, japanese_room_rect, self.colors['japanese_room'], 
                                  self.colors['wall'], corner_radius=10, outline_width=2)
        
        if self.font_large != ImageFont.load_default():
            draw.text((750, 360), "和室", fill=self.text_color, font=self.font_medium)
            draw.text((780, 390), "8畳", fill=self.size_text_color, font=self.font_large)
        else:
            draw.text((730, 360), "Japanese", fill=self.text_color, font=self.font_medium)
            draw.text((780, 390), "8", fill=self.size_text_color, font=self.font_large)
        
        # 5. 洋室（洋10）
        western_room_rect = [680, 480, 930, 700]
        room_coords.append(western_room_rect)
        self.draw_rounded_rectangle(draw, western_room_rect, self.colors['bedroom'], 
                                  self.colors['wall'], corner_radius=10, outline_width=2)
        
        if self.font_large != ImageFont.load_default():
            draw.text((750, 570), "洋室", fill=self.text_color, font=self.font_medium)
            draw.text((780, 600), "10畳", fill=self.size_text_color, font=self.font_large)
        else:
            draw.text((730, 570), "Western", fill=self.text_color, font=self.font_medium)
            draw.text((780, 600), "10", fill=self.size_text_color, font=self.font_large)
        
        # 6. 浴室
        bathroom_rect = [60, 180, 180, 280]
        room_coords.append(bathroom_rect)
        self.draw_rounded_rectangle(draw, bathroom_rect, self.colors['bathroom'], 
                                  self.colors['wall'], corner_radius=8, outline_width=2)
        
        if self.font_large != ImageFont.load_default():
            draw.text((100, 220), "浴室", fill=self.text_color, font=self.font_small)
        else:
            draw.text((100, 220), "Bath", fill=self.text_color, font=self.font_small)
        
        # 7. トイレ
        toilet_rect = [60, 280, 140, 380]
        room_coords.append(toilet_rect)
        self.draw_rounded_rectangle(draw, toilet_rect, self.colors['toilet'], 
                                  self.colors['wall'], corner_radius=8, outline_width=2)
        
        if self.font_large != ImageFont.load_default():
            draw.text((75, 320), "トイレ", fill=self.text_color, font=self.font_small)
        else:
            draw.text((80, 320), "WC", fill=self.text_color, font=self.font_small)
        
        # 8. 玄関
        entrance_rect = [380, 80, 580, 180]
        room_coords.append(entrance_rect)
        self.draw_rounded_rectangle(draw, entrance_rect, self.colors['entrance'], 
                                  self.colors['wall'], corner_radius=10, outline_width=2)
        
        if self.font_large != ImageFont.load_default():
            draw.text((430, 120), "玄関", fill=self.text_color, font=self.font_medium)
        else:
            draw.text((410, 120), "Entrance", fill=self.text_color, font=self.font_medium)
        
        # 9. 階段
        stairs_rect = [480, 180, 580, 280]
        room_coords.append(stairs_rect)
        self.draw_rounded_rectangle(draw, stairs_rect, self.colors['stairs'], 
                                  self.colors['wall'], corner_radius=8, outline_width=2)
        
        if self.font_large != ImageFont.load_default():
            draw.text((500, 220), "階段", fill=self.text_color, font=self.font_small)
        else:
            draw.text((500, 220), "Stairs", fill=self.text_color, font=self.font_small)
        
        # 10. クローゼット（複数）
        closet1_rect = [930, 280, 1030, 380]
        room_coords.append(closet1_rect)
        self.draw_rounded_rectangle(draw, closet1_rect, self.colors['closet'], 
                                  self.colors['wall'], corner_radius=6, outline_width=2)
        draw.text((950, 320), "CL", fill=self.text_color, font=self.font_small)
        
        closet2_rect = [930, 480, 1030, 580]
        room_coords.append(closet2_rect)
        self.draw_rounded_rectangle(draw, closet2_rect, self.colors['closet'], 
                                  self.colors['wall'], corner_radius=6, outline_width=2)
        draw.text((950, 520), "CL", fill=self.text_color, font=self.font_small)
        
        # 11. 納戸
        storage_rect = [930, 380, 1080, 480]
        room_coords.append(storage_rect)
        self.draw_rounded_rectangle(draw, storage_rect, self.colors['storage'], 
                                  self.colors['wall'], corner_radius=8, outline_width=2)
        
        if self.font_large != ImageFont.load_default():
            draw.text((970, 420), "納戸", fill=self.text_color, font=self.font_small)
        else:
            draw.text((970, 420), "Storage", fill=self.text_color, font=self.font_small)
        
        # 微妙な影を追加
        image = self.add_subtle_shadow(image, room_coords)
        
        # 方位記号を追加
        self.draw_soft_compass(draw, 1050, 130)
        
        # タイトルを追加
        if self.font_large != ImageFont.load_default():
            draw.text((40, 15), "1階間取り図（ソフトスタイル）", fill=self.text_color, font=self.font_large)
        else:
            draw.text((40, 15), "1F Floor Plan (Soft Style)", fill=self.text_color, font=self.font_large)
        
        return image
    
    def draw_soft_compass(self, draw, x, y):
        """柔らかい方位記号を描画"""
        # 円を描画
        radius = 25
        draw.ellipse([x-radius, y-radius, x+radius, y+radius], 
                    fill=(255, 255, 255), outline=self.colors['wall'], width=2)
        
        # 北の矢印（少し丸みを帯びた）
        draw.polygon([(x, y-radius+8), (x-6, y-8), (x+6, y-8)], 
                    fill=self.colors['wall'])
        
        # N の文字
        draw.text((x-6, y-radius-18), "N", fill=self.text_color, font=self.font_small)

def main():
    creator = SoftFloorPlanCreator()
    
    # 柔らかい1階の間取り図を作成
    soft_floor_plan = creator.create_soft_floor_plan()
    soft_floor_plan.save("soft_floor_plan_1f.png", 'PNG', dpi=(300, 300))
    print("✅ 柔らかい1階間取り図を作成しました: soft_floor_plan_1f.png")
    
    print("\n🎨 参考画像のような柔らかい間取り図が完成しました！")
    print("特徴:")
    print("- 角丸の部屋で柔らかい印象")
    print("- 自然な色合い")
    print("- 微妙な影効果")
    print("- 少し灰色がかった背景")
    print("- 優しい線の太さ")
    print("- 参考画像に近いスタイル")

if __name__ == "__main__":
    main()