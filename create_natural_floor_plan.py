#!/usr/bin/env python3
"""
参考画像のような自然で手描き風の間取り図作成スクリプト
完全に有機的で、硬さを排除した柔らかい間取り図を作成します
"""

from PIL import Image, ImageDraw, ImageFont, ImageFilter
import numpy as np
import os
import random
import math

class NaturalFloorPlanCreator:
    def __init__(self, width=1200, height=800):
        self.width = width
        self.height = height
        
        # より自然で温かいカラーパレット
        self.colors = {
            'wall': (80, 80, 80),               # 壁：自然なグレー
            'living': (255, 245, 220),          # リビング：暖かいクリーム
            'dining': (255, 250, 235),          # ダイニング：薄いアイボリー
            'kitchen': (235, 255, 235),         # キッチン：薄い緑
            'bedroom': (240, 248, 255),         # 寝室：薄い空色
            'japanese_room': (245, 255, 245),   # 和室：薄い若草色
            'bathroom': (235, 250, 255),        # 浴室：薄い水色
            'toilet': (250, 240, 255),          # トイレ：薄いラベンダー
            'closet': (255, 255, 240),          # クローゼット：薄いクリーム
            'entrance': (255, 240, 240),        # 玄関：薄いローズ
            'balcony': (240, 255, 250),         # バルコニー：薄いミント
            'stairs': (248, 248, 248),          # 階段：薄いグレー
            'storage': (255, 245, 255),         # 納戸：薄いピンク
        }
        
        # テキストの色
        self.text_color = (60, 60, 60)          # 柔らかいグレー
        self.size_text_color = (200, 80, 80)   # 柔らかい赤
        
        # 日本語フォントを設定
        self.setup_fonts()
        
    def setup_fonts(self):
        """日本語フォントを設定"""
        font_paths = [
            "C:/Windows/Fonts/meiryo.ttc",        # メイリオ（丸みがある）
            "C:/Windows/Fonts/yugothm.ttc",       # 游ゴシック Medium
            "C:/Windows/Fonts/msgothic.ttc",      # MS ゴシック
        ]
        
        for font_path in font_paths:
            if os.path.exists(font_path):
                try:
                    self.font_large = ImageFont.truetype(font_path, 28)
                    self.font_medium = ImageFont.truetype(font_path, 22)
                    self.font_small = ImageFont.truetype(font_path, 16)
                    print(f"✅ 日本語フォントを読み込みました: {font_path}")
                    return
                except Exception as e:
                    continue
        
        # デフォルトフォント
        self.font_large = ImageFont.load_default()
        self.font_medium = ImageFont.load_default()
        self.font_small = ImageFont.load_default()
    
    def add_noise_to_point(self, x, y, noise_level=2):
        """座標に微妙なノイズを追加して手描き風にする"""
        noise_x = random.uniform(-noise_level, noise_level)
        noise_y = random.uniform(-noise_level, noise_level)
        return int(x + noise_x), int(y + noise_y)
    
    def draw_organic_shape(self, draw, center_x, center_y, width, height, fill_color, outline_color, outline_width=2):
        """有機的な形状を描画"""
        # 楕円ベースで微妙に歪ませる
        points = []
        num_points = 32
        
        for i in range(num_points):
            angle = 2 * math.pi * i / num_points
            
            # 基本の楕円座標
            base_x = center_x + (width / 2) * math.cos(angle)
            base_y = center_y + (height / 2) * math.sin(angle)
            
            # 微妙な歪みを追加
            distortion = random.uniform(0.95, 1.05)
            x = base_x * distortion
            y = base_y * distortion
            
            # さらに微妙なノイズ
            x, y = self.add_noise_to_point(x, y, 3)
            points.append((x, y))
        
        # 形状を描画
        draw.polygon(points, fill=fill_color, outline=outline_color, width=outline_width)
        return points
    
    def draw_soft_rectangle(self, draw, x1, y1, x2, y2, fill_color, outline_color, corner_radius=20, outline_width=2):
        """非常に柔らかい角丸四角形を描画"""
        # 角丸四角形の各部分を描画
        
        # 中央部分
        draw.rectangle([x1 + corner_radius, y1, x2 - corner_radius, y2], fill=fill_color)
        draw.rectangle([x1, y1 + corner_radius, x2, y2 - corner_radius], fill=fill_color)
        
        # 四隅の円（少し歪ませる）
        corners = [
            (x1, y1, x1 + 2*corner_radius, y1 + 2*corner_radius),  # 左上
            (x2 - 2*corner_radius, y1, x2, y1 + 2*corner_radius),  # 右上
            (x1, y2 - 2*corner_radius, x1 + 2*corner_radius, y2),  # 左下
            (x2 - 2*corner_radius, y2 - 2*corner_radius, x2, y2)   # 右下
        ]
        
        for corner in corners:
            # 微妙に歪ませた楕円
            cx1, cy1, cx2, cy2 = corner
            distort_x = random.uniform(0.9, 1.1)
            distort_y = random.uniform(0.9, 1.1)
            
            new_cx2 = cx1 + (cx2 - cx1) * distort_x
            new_cy2 = cy1 + (cy2 - cy1) * distort_y
            
            draw.ellipse([cx1, cy1, new_cx2, new_cy2], fill=fill_color)
        
        # 柔らかいアウトライン
        if outline_width > 0:
            # 複数の細い線で柔らかいアウトラインを作成
            for i in range(outline_width):
                alpha = 100 - i * 20  # 外側ほど薄く
                if alpha > 0:
                    # 微妙にずらした線を描画
                    offset = i * 0.5
                    draw.rectangle([x1 - offset, y1 - offset, x2 + offset, y2 + offset], 
                                 outline=outline_color, width=1)
    
    def add_texture_overlay(self, image):
        """テクスチャオーバーレイを追加して紙のような質感にする"""
        # ノイズテクスチャを作成
        noise = Image.new('RGBA', image.size, (0, 0, 0, 0))
        noise_pixels = []
        
        for y in range(image.height):
            for x in range(image.width):
                # 微妙なノイズを追加
                noise_value = random.randint(-10, 10)
                alpha = random.randint(5, 15)
                noise_pixels.append((noise_value, noise_value, noise_value, alpha))
        
        noise.putdata(noise_pixels)
        
        # 元の画像にノイズを合成
        image = Image.alpha_composite(image.convert('RGBA'), noise)
        return image.convert('RGB')
    
    def create_natural_floor_plan(self):
        """自然で有機的な1階の間取り図を作成"""
        # 温かみのある背景色
        background_color = (252, 252, 250)  # 少しクリーム色がかった白
        image = Image.new('RGB', (self.width, self.height), background_color)
        draw = ImageDraw.Draw(image)
        
        # 外壁を非常に柔らかく描画
        wall_margin = 30
        self.draw_soft_rectangle(draw, wall_margin, wall_margin, 
                               self.width - wall_margin, self.height - wall_margin,
                               (255, 255, 255), self.colors['wall'], 
                               corner_radius=25, outline_width=3)
        
        # 各部屋を有機的に描画
        
        # 1. リビング・ダイニング（L15）- 大きな中央スペース
        living_center_x, living_center_y = 430, 455
        living_width, living_height = 480, 320
        self.draw_organic_shape(draw, living_center_x, living_center_y, 
                              living_width, living_height, 
                              self.colors['living'], self.colors['wall'], 2)
        
        # テキスト描画
        if self.font_large != ImageFont.load_default():
            draw.text((350, 430), "リビング・ダイニング", fill=self.text_color, font=self.font_medium)
            draw.text((420, 460), "15畳", fill=self.size_text_color, font=self.font_large)
        else:
            draw.text((320, 430), "Living・Dining", fill=self.text_color, font=self.font_medium)
            draw.text((420, 460), "15", fill=self.size_text_color, font=self.font_large)
        
        # 2. キッチン（K7）
        kitchen_center_x, kitchen_center_y = 120, 455
        kitchen_width, kitchen_height = 140, 180
        self.draw_organic_shape(draw, kitchen_center_x, kitchen_center_y,
                              kitchen_width, kitchen_height,
                              self.colors['kitchen'], self.colors['wall'], 2)
        
        if self.font_large != ImageFont.load_default():
            draw.text((80, 440), "キッチン", fill=self.text_color, font=self.font_small)
            draw.text((95, 465), "7畳", fill=self.size_text_color, font=self.font_medium)
        else:
            draw.text((80, 440), "Kitchen", fill=self.text_color, font=self.font_small)
            draw.text((100, 465), "7", fill=self.size_text_color, font=self.font_medium)
        
        # 3. 和室（和8）
        japanese_center_x, japanese_center_y = 805, 380
        japanese_width, japanese_height = 220, 180
        self.draw_organic_shape(draw, japanese_center_x, japanese_center_y,
                              japanese_width, japanese_height,
                              self.colors['japanese_room'], self.colors['wall'], 2)
        
        if self.font_large != ImageFont.load_default():
            draw.text((750, 360), "和室", fill=self.text_color, font=self.font_medium)
            draw.text((780, 390), "8畳", fill=self.size_text_color, font=self.font_large)
        else:
            draw.text((750, 360), "Japanese", fill=self.text_color, font=self.font_medium)
            draw.text((780, 390), "8", fill=self.size_text_color, font=self.font_large)
        
        # 4. 洋室（洋10）
        western_center_x, western_center_y = 805, 590
        western_width, western_height = 220, 200
        self.draw_organic_shape(draw, western_center_x, western_center_y,
                              western_width, western_height,
                              self.colors['bedroom'], self.colors['wall'], 2)
        
        if self.font_large != ImageFont.load_default():
            draw.text((750, 570), "洋室", fill=self.text_color, font=self.font_medium)
            draw.text((780, 600), "10畳", fill=self.size_text_color, font=self.font_large)
        else:
            draw.text((750, 570), "Western", fill=self.text_color, font=self.font_medium)
            draw.text((780, 600), "10", fill=self.size_text_color, font=self.font_large)
        
        # 5. 浴室
        bathroom_center_x, bathroom_center_y = 120, 230
        bathroom_width, bathroom_height = 140, 120
        self.draw_organic_shape(draw, bathroom_center_x, bathroom_center_y,
                              bathroom_width, bathroom_height,
                              self.colors['bathroom'], self.colors['wall'], 2)
        
        if self.font_large != ImageFont.load_default():
            draw.text((90, 220), "浴室", fill=self.text_color, font=self.font_small)
        else:
            draw.text((90, 220), "Bath", fill=self.text_color, font=self.font_small)
        
        # 6. トイレ
        toilet_center_x, toilet_center_y = 120, 330
        toilet_width, toilet_height = 100, 80
        self.draw_organic_shape(draw, toilet_center_x, toilet_center_y,
                              toilet_width, toilet_height,
                              self.colors['toilet'], self.colors['wall'], 2)
        
        if self.font_large != ImageFont.load_default():
            draw.text((95, 320), "トイレ", fill=self.text_color, font=self.font_small)
        else:
            draw.text((95, 320), "WC", fill=self.text_color, font=self.font_small)
        
        # 7. 玄関
        entrance_center_x, entrance_center_y = 480, 130
        entrance_width, entrance_height = 180, 120
        self.draw_organic_shape(draw, entrance_center_x, entrance_center_y,
                              entrance_width, entrance_height,
                              self.colors['entrance'], self.colors['wall'], 2)
        
        if self.font_large != ImageFont.load_default():
            draw.text((430, 120), "玄関", fill=self.text_color, font=self.font_medium)
        else:
            draw.text((430, 120), "Entrance", fill=self.text_color, font=self.font_medium)
        
        # 8. 階段
        stairs_center_x, stairs_center_y = 530, 230
        stairs_width, stairs_height = 120, 120
        self.draw_organic_shape(draw, stairs_center_x, stairs_center_y,
                              stairs_width, stairs_height,
                              self.colors['stairs'], self.colors['wall'], 2)
        
        if self.font_large != ImageFont.load_default():
            draw.text((500, 220), "階段", fill=self.text_color, font=self.font_small)
        else:
            draw.text((500, 220), "Stairs", fill=self.text_color, font=self.font_small)
        
        # 9. クローゼット（複数）
        closet1_center_x, closet1_center_y = 980, 330
        closet1_width, closet1_height = 80, 80
        self.draw_organic_shape(draw, closet1_center_x, closet1_center_y,
                              closet1_width, closet1_height,
                              self.colors['closet'], self.colors['wall'], 1)
        draw.text((960, 320), "CL", fill=self.text_color, font=self.font_small)
        
        closet2_center_x, closet2_center_y = 980, 530
        closet2_width, closet2_height = 80, 80
        self.draw_organic_shape(draw, closet2_center_x, closet2_center_y,
                              closet2_width, closet2_height,
                              self.colors['closet'], self.colors['wall'], 1)
        draw.text((960, 520), "CL", fill=self.text_color, font=self.font_small)
        
        # 10. 納戸
        storage_center_x, storage_center_y = 1005, 430
        storage_width, storage_height = 120, 80
        self.draw_organic_shape(draw, storage_center_x, storage_center_y,
                              storage_width, storage_height,
                              self.colors['storage'], self.colors['wall'], 1)
        
        if self.font_large != ImageFont.load_default():
            draw.text((970, 420), "納戸", fill=self.text_color, font=self.font_small)
        else:
            draw.text((970, 420), "Storage", fill=self.text_color, font=self.font_small)
        
        # 自然な方位記号を追加
        self.draw_natural_compass(draw, 1050, 120)
        
        # タイトルを追加
        if self.font_large != ImageFont.load_default():
            draw.text((40, 15), "1階間取り図（ナチュラルスタイル）", fill=self.text_color, font=self.font_large)
        else:
            draw.text((40, 15), "1F Floor Plan (Natural Style)", fill=self.text_color, font=self.font_large)
        
        # テクスチャオーバーレイを追加
        image = self.add_texture_overlay(image)
        
        return image
    
    def draw_natural_compass(self, draw, x, y):
        """自然な方位記号を描画"""
        # 有機的な円を描画
        radius = 22
        points = []
        num_points = 16
        
        for i in range(num_points):
            angle = 2 * math.pi * i / num_points
            distortion = random.uniform(0.95, 1.05)
            px = x + radius * math.cos(angle) * distortion
            py = y + radius * math.sin(angle) * distortion
            px, py = self.add_noise_to_point(px, py, 1)
            points.append((px, py))
        
        draw.polygon(points, fill=(255, 255, 255), outline=self.colors['wall'], width=2)
        
        # 北の矢印（少し歪ませる）
        arrow_points = [
            self.add_noise_to_point(x, y - radius + 8, 1),
            self.add_noise_to_point(x - 5, y - 6, 1),
            self.add_noise_to_point(x + 5, y - 6, 1)
        ]
        draw.polygon(arrow_points, fill=self.colors['wall'])
        
        # N の文字
        draw.text((x-5, y-radius-16), "N", fill=self.text_color, font=self.font_small)

def main():
    creator = NaturalFloorPlanCreator()
    
    # 自然で有機的な1階の間取り図を作成
    natural_floor_plan = creator.create_natural_floor_plan()
    natural_floor_plan.save("natural_floor_plan_1f.png", 'PNG', dpi=(300, 300))
    print("✅ 自然で有機的な1階間取り図を作成しました: natural_floor_plan_1f.png")
    
    print("\n🌿 参考画像のような自然で柔らかい間取り図が完成しました！")
    print("特徴:")
    print("- 完全に有機的な形状（硬い線なし）")
    print("- 手描き風の微妙な歪み")
    print("- 温かみのある自然な色合い")
    print("- 紙のようなテクスチャ")
    print("- 柔らかいアウトライン")
    print("- 参考画像に最も近いスタイル")

if __name__ == "__main__":
    main()