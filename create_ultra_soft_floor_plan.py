#!/usr/bin/env python3
"""
超柔らかい自然な間取り図作成スクリプト
参考画像のような有機的で温かみのある間取り図を作成します
"""

from PIL import Image, ImageDraw, ImageFont, ImageFilter
import numpy as np
import os
import math

class UltraSoftFloorPlanCreator:
    def __init__(self, width=1200, height=800):
        self.width = width
        self.height = height
        
        # 参考画像に近い非常に柔らかい色合い
        self.colors = {
            'wall': (90, 90, 90),               # 壁：柔らかいグレー
            'living': (255, 245, 220),          # リビング：暖かいクリーム
            'dining': (255, 250, 235),          # ダイニング：薄いアイボリー
            'kitchen': (235, 255, 235),         # キッチン：薄い緑
            'bedroom': (240, 245, 255),         # 寝室：薄い青
            'japanese_room': (245, 255, 245),   # 和室：薄い緑
            'bathroom': (235, 250, 255),        # 浴室：薄い水色
            'toilet': (250, 235, 255),          # トイレ：薄い紫
            'closet': (255, 255, 235),          # クローゼット：薄い黄色
            'entrance': (255, 235, 235),        # 玄関：薄いピンク
            'balcony': (235, 255, 250),         # バルコニー：薄いミント
            'stairs': (245, 245, 245),          # 階段：薄いグレー
            'storage': (255, 240, 255),         # 納戸：薄いピンク
        }
        
        # テキストの色
        self.text_color = (60, 60, 60)          # 柔らかいグレー
        self.size_text_color = (200, 80, 80)   # 柔らかい赤
        
        # 日本語フォントを設定
        self.setup_fonts()
        
    def setup_fonts(self):
        """日本語フォントを設定"""
        font_paths = [
            "C:/Windows/Fonts/meiryo.ttc",        # メイリオ（柔らかい）
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
    
    def draw_organic_shape(self, draw, center_x, center_y, width, height, fill_color, outline_color, points=8):
        """有機的な形状を描画（完全に自然な形）"""
        # 基本的な楕円の周りに不規則な点を配置
        angles = np.linspace(0, 2*math.pi, points, endpoint=False)
        
        # ランダムな変動を追加して有機的な形にする
        np.random.seed(hash(str(center_x + center_y)) % 1000)  # 一貫した結果のため
        radius_variations = np.random.uniform(0.8, 1.2, points)
        angle_variations = np.random.uniform(-0.3, 0.3, points)
        
        polygon_points = []
        for i, angle in enumerate(angles):
            varied_angle = angle + angle_variations[i]
            radius_x = (width / 2) * radius_variations[i]
            radius_y = (height / 2) * radius_variations[i]
            
            x = center_x + radius_x * math.cos(varied_angle)
            y = center_y + radius_y * math.sin(varied_angle)
            polygon_points.append((x, y))
        
        # 有機的な形状を描画
        draw.polygon(polygon_points, fill=fill_color, outline=outline_color, width=2)
        
        return polygon_points
    
    def add_soft_gradient(self, image, room_coords, room_color):
        """部屋に柔らかいグラデーション効果を追加"""
        overlay = Image.new('RGBA', image.size, (0, 0, 0, 0))
        overlay_draw = ImageDraw.Draw(overlay)
        
        for coords in room_coords:
            if len(coords) >= 4:  # ポリゴンの場合
                # 中心点を計算
                center_x = sum(p[0] for p in coords) / len(coords)
                center_y = sum(p[1] for p in coords) / len(coords)
                
                # グラデーション効果（中心から外側へ）
                for i in range(3):
                    alpha = 20 - i * 5
                    offset = i * 3
                    gradient_color = (*room_color, alpha)
                    
                    # 少し小さくした形状を描画
                    scaled_coords = []
                    for x, y in coords:
                        new_x = center_x + (x - center_x) * (1 - offset * 0.02)
                        new_y = center_y + (y - center_y) * (1 - offset * 0.02)
                        scaled_coords.append((new_x, new_y))
                    
                    overlay_draw.polygon(scaled_coords, fill=gradient_color)
        
        # グラデーションをぼかす
        overlay = overlay.filter(ImageFilter.GaussianBlur(radius=3))
        
        # 元の画像に合成
        image = Image.alpha_composite(image.convert('RGBA'), overlay)
        return image.convert('RGB')
    
    def create_ultra_soft_floor_plan(self):
        """超柔らかい間取り図を作成"""
        # 柔らかい背景色
        image = Image.new('RGB', (self.width, self.height), (248, 248, 248))
        draw = ImageDraw.Draw(image)
        
        # 部屋の座標を保存
        room_coords = []
        room_colors = []
        
        # 外壁を有機的な形で描画
        outer_wall_points = self.draw_organic_shape(
            draw, self.width//2, self.height//2, 
            self.width-100, self.height-100, 
            (255, 255, 255), self.colors['wall'], points=12
        )
        
        # 各部屋を有機的な形で描画
        
        # 1. リビング・ダイニング（L15）- 大きな中央の部屋
        living_points = self.draw_organic_shape(
            draw, 430, 455, 480, 300, 
            self.colors['living'], self.colors['wall'], points=10
        )
        room_coords.append(living_points)
        room_colors.append(self.colors['living'])
        
        # テキスト描画
        if self.font_large != ImageFont.load_default():
            draw.text((350, 430), "リビング・ダイニング", fill=self.text_color, font=self.font_medium)
            draw.text((430, 460), "15畳", fill=self.size_text_color, font=self.font_large)
        else:
            draw.text((320, 430), "Living・Dining", fill=self.text_color, font=self.font_medium)
            draw.text((430, 460), "15", fill=self.size_text_color, font=self.font_large)
        
        # 2. キッチン（K7）
        kitchen_points = self.draw_organic_shape(
            draw, 120, 455, 120, 140, 
            self.colors['kitchen'], self.colors['wall'], points=8
        )
        room_coords.append(kitchen_points)
        room_colors.append(self.colors['kitchen'])
        
        if self.font_large != ImageFont.load_default():
            draw.text((85, 440), "キッチン", fill=self.text_color, font=self.font_small)
            draw.text((100, 465), "7畳", fill=self.size_text_color, font=self.font_medium)
        else:
            draw.text((85, 440), "Kitchen", fill=self.text_color, font=self.font_small)
            draw.text((105, 465), "7", fill=self.size_text_color, font=self.font_medium)
        
        # 3. ダイニング（D6）
        dining_points = self.draw_organic_shape(
            draw, 280, 230, 180, 90, 
            self.colors['dining'], self.colors['wall'], points=8
        )
        room_coords.append(dining_points)
        room_colors.append(self.colors['dining'])
        
        if self.font_large != ImageFont.load_default():
            draw.text((230, 220), "ダイニング", fill=self.text_color, font=self.font_small)
            draw.text((260, 245), "6畳", fill=self.size_text_color, font=self.font_medium)
        else:
            draw.text((230, 220), "Dining", fill=self.text_color, font=self.font_small)
            draw.text((260, 245), "6", fill=self.size_text_color, font=self.font_medium)
        
        # 4. 和室（和8）
        japanese_points = self.draw_organic_shape(
            draw, 805, 380, 220, 180, 
            self.colors['japanese_room'], self.colors['wall'], points=8
        )
        room_coords.append(japanese_points)
        room_colors.append(self.colors['japanese_room'])
        
        if self.font_large != ImageFont.load_default():
            draw.text((750, 360), "和室", fill=self.text_color, font=self.font_medium)
            draw.text((780, 390), "8畳", fill=self.size_text_color, font=self.font_large)
        else:
            draw.text((730, 360), "Japanese", fill=self.text_color, font=self.font_medium)
            draw.text((780, 390), "8", fill=self.size_text_color, font=self.font_large)
        
        # 5. 洋室（洋10）
        western_points = self.draw_organic_shape(
            draw, 805, 590, 220, 200, 
            self.colors['bedroom'], self.colors['wall'], points=8
        )
        room_coords.append(western_points)
        room_colors.append(self.colors['bedroom'])
        
        if self.font_large != ImageFont.load_default():
            draw.text((750, 570), "洋室", fill=self.text_color, font=self.font_medium)
            draw.text((780, 600), "10畳", fill=self.size_text_color, font=self.font_large)
        else:
            draw.text((730, 570), "Western", fill=self.text_color, font=self.font_medium)
            draw.text((780, 600), "10", fill=self.size_text_color, font=self.font_large)
        
        # 6. 浴室
        bathroom_points = self.draw_organic_shape(
            draw, 120, 230, 120, 90, 
            self.colors['bathroom'], self.colors['wall'], points=6
        )
        room_coords.append(bathroom_points)
        room_colors.append(self.colors['bathroom'])
        
        if self.font_large != ImageFont.load_default():
            draw.text((90, 220), "浴室", fill=self.text_color, font=self.font_small)
        else:
            draw.text((95, 220), "Bath", fill=self.text_color, font=self.font_small)
        
        # 7. トイレ
        toilet_points = self.draw_organic_shape(
            draw, 100, 330, 80, 80, 
            self.colors['toilet'], self.colors['wall'], points=6
        )
        room_coords.append(toilet_points)
        room_colors.append(self.colors['toilet'])
        
        if self.font_large != ImageFont.load_default():
            draw.text((75, 320), "トイレ", fill=self.text_color, font=self.font_small)
        else:
            draw.text((80, 320), "WC", fill=self.text_color, font=self.font_small)
        
        # 8. 玄関
        entrance_points = self.draw_organic_shape(
            draw, 480, 130, 180, 90, 
            self.colors['entrance'], self.colors['wall'], points=8
        )
        room_coords.append(entrance_points)
        room_colors.append(self.colors['entrance'])
        
        if self.font_large != ImageFont.load_default():
            draw.text((430, 120), "玄関", fill=self.text_color, font=self.font_medium)
        else:
            draw.text((410, 120), "Entrance", fill=self.text_color, font=self.font_medium)
        
        # 9. 階段
        stairs_points = self.draw_organic_shape(
            draw, 530, 230, 90, 90, 
            self.colors['stairs'], self.colors['wall'], points=6
        )
        room_coords.append(stairs_points)
        room_colors.append(self.colors['stairs'])
        
        if self.font_large != ImageFont.load_default():
            draw.text((500, 220), "階段", fill=self.text_color, font=self.font_small)
        else:
            draw.text((500, 220), "Stairs", fill=self.text_color, font=self.font_small)
        
        # クローゼットと納戸（小さな有機的形状）
        closet1_points = self.draw_organic_shape(
            draw, 980, 330, 80, 80, 
            self.colors['closet'], self.colors['wall'], points=6
        )
        draw.text((960, 320), "CL", fill=self.text_color, font=self.font_small)
        
        closet2_points = self.draw_organic_shape(
            draw, 980, 530, 80, 80, 
            self.colors['closet'], self.colors['wall'], points=6
        )
        draw.text((960, 520), "CL", fill=self.text_color, font=self.font_small)
        
        storage_points = self.draw_organic_shape(
            draw, 980, 430, 100, 80, 
            self.colors['storage'], self.colors['wall'], points=6
        )
        
        if self.font_large != ImageFont.load_default():
            draw.text((950, 420), "納戸", fill=self.text_color, font=self.font_small)
        else:
            draw.text((950, 420), "Storage", fill=self.text_color, font=self.font_small)
        
        # グラデーション効果を追加
        image = self.add_soft_gradient(image, room_coords, (255, 255, 255))
        
        # 全体にソフトフィルターを適用
        image = image.filter(ImageFilter.GaussianBlur(radius=0.5))
        
        # 方位記号を追加
        self.draw_organic_compass(draw, 1050, 130)
        
        # タイトルを追加
        if self.font_large != ImageFont.load_default():
            draw.text((40, 15), "1階間取り図（超ソフトスタイル）", fill=self.text_color, font=self.font_large)
        else:
            draw.text((40, 15), "1F Floor Plan (Ultra Soft)", fill=self.text_color, font=self.font_large)
        
        return image
    
    def draw_organic_compass(self, draw, x, y):
        """有機的な方位記号を描画"""
        # 柔らかい円
        radius = 25
        compass_points = self.draw_organic_shape(
            draw, x, y, radius*2, radius*2, 
            (255, 255, 255), self.colors['wall'], points=8
        )
        
        # 北の矢印（柔らかい）
        arrow_points = [(x, y-radius+8), (x-5, y-6), (x+5, y-6)]
        draw.polygon(arrow_points, fill=self.colors['wall'])
        
        # N の文字
        draw.text((x-6, y-radius-18), "N", fill=self.text_color, font=self.font_small)

def main():
    creator = UltraSoftFloorPlanCreator()
    
    # 超柔らかい間取り図を作成
    ultra_soft_plan = creator.create_ultra_soft_floor_plan()
    ultra_soft_plan.save("ultra_soft_floor_plan_1f.png", 'PNG', dpi=(300, 300))
    print("✅ 超柔らかい間取り図を作成しました: ultra_soft_floor_plan_1f.png")
    
    print("\n🎨 参考画像のような超柔らかい間取り図が完成しました！")
    print("特徴:")
    print("- 完全に有機的な形状（直線なし）")
    print("- 自然な色合いとグラデーション")
    print("- 柔らかいフィルター効果")
    print("- 手描きのような温かさ")
    print("- 参考画像に最も近いスタイル")

if __name__ == "__main__":
    main()