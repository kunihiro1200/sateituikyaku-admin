#!/usr/bin/env python3
"""
間取り図のカラー化・視認性向上スクリプト
PDFから抽出した間取り図を分かりやすくカラー化し、文字を大きくします
"""

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import fitz  # PyMuPDF
import os
import sys

class FloorPlanColorizer:
    def __init__(self):
        # カラーパレット（部屋ごとの色分け）
        self.room_colors = {
            'living': (255, 230, 200),      # リビング：薄いオレンジ
            'dining': (255, 240, 220),      # ダイニング：薄いベージュ
            'kitchen': (200, 255, 200),     # キッチン：薄い緑
            'bedroom': (220, 220, 255),     # 寝室：薄い青
            'bathroom': (200, 240, 255),    # 浴室：薄い水色
            'toilet': (240, 200, 255),      # トイレ：薄い紫
            'closet': (255, 255, 200),      # クローゼット：薄い黄色
            'entrance': (255, 200, 200),    # 玄関：薄い赤
            'balcony': (200, 255, 240),     # バルコニー：薄いミント
            'stairs': (240, 240, 240),      # 階段：薄いグレー
        }
        
        # 線の色
        self.line_color = (50, 50, 50)      # 濃いグレー
        self.text_color = (0, 0, 0)         # 黒
        
    def pdf_to_image(self, pdf_path, page_num=0, dpi=300):
        """PDFを高解像度画像に変換"""
        try:
            doc = fitz.open(pdf_path)
            page = doc[page_num]
            
            # 高解像度で画像を取得
            mat = fitz.Matrix(dpi/72, dpi/72)
            pix = page.get_pixmap(matrix=mat)
            img_data = pix.tobytes("png")
            
            # PIL Imageに変換
            img = Image.open(io.BytesIO(img_data))
            doc.close()
            
            return img
        except Exception as e:
            print(f"PDF読み込みエラー: {e}")
            return None
    
    def enhance_image(self, image):
        """画像の前処理・エンハンス"""
        # PIL ImageをOpenCV形式に変換
        cv_image = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
        
        # グレースケール変換
        gray = cv2.cvtColor(cv_image, cv2.COLOR_BGR2GRAY)
        
        # コントラスト向上
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
        enhanced = clahe.apply(gray)
        
        # ノイズ除去
        denoised = cv2.medianBlur(enhanced, 3)
        
        # エッジ検出
        edges = cv2.Canny(denoised, 50, 150, apertureSize=3)
        
        return denoised, edges
    
    def detect_rooms(self, image, edges):
        """部屋の領域を検出"""
        # 輪郭検出
        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        # 面積でフィルタリング（小さすぎる・大きすぎる輪郭を除外）
        min_area = 1000
        max_area = image.shape[0] * image.shape[1] * 0.3
        
        room_contours = []
        for contour in contours:
            area = cv2.contourArea(contour)
            if min_area < area < max_area:
                room_contours.append(contour)
        
        return room_contours
    
    def colorize_rooms(self, image, room_contours):
        """部屋をカラー化"""
        # カラー画像を作成
        height, width = image.shape
        colored_image = np.zeros((height, width, 3), dtype=np.uint8)
        
        # 背景を白に設定
        colored_image.fill(255)
        
        # 各部屋を異なる色で塗りつぶし
        colors = list(self.room_colors.values())
        
        for i, contour in enumerate(room_contours):
            color = colors[i % len(colors)]
            cv2.fillPoly(colored_image, [contour], color)
        
        return colored_image
    
    def enhance_text_and_numbers(self, image):
        """文字と数字を大きく、見やすくする"""
        # PIL Imageに変換
        pil_image = Image.fromarray(cv2.cvtColor(image, cv2.COLOR_BGR2RGB))
        draw = ImageDraw.Draw(pil_image)
        
        # フォントサイズを大きく設定
        try:
            # システムフォントを使用（日本語対応）
            font_large = ImageFont.truetype("arial.ttf", 48)
            font_medium = ImageFont.truetype("arial.ttf", 36)
        except:
            # フォントが見つからない場合はデフォルト
            font_large = ImageFont.load_default()
            font_medium = ImageFont.load_default()
        
        return pil_image
    
    def add_room_labels(self, image, room_contours):
        """部屋にラベルを追加"""
        pil_image = Image.fromarray(cv2.cvtColor(image, cv2.COLOR_BGR2RGB))
        draw = ImageDraw.Draw(pil_image)
        
        # 部屋名のリスト（推測）
        room_names = ["LDK", "寝室", "和室", "浴室", "トイレ", "玄関", "クローゼット", "バルコニー"]
        
        try:
            font = ImageFont.truetype("arial.ttf", 32)
        except:
            font = ImageFont.load_default()
        
        for i, contour in enumerate(room_contours):
            if i < len(room_names):
                # 輪郭の中心点を計算
                M = cv2.moments(contour)
                if M["m00"] != 0:
                    cx = int(M["m10"] / M["m00"])
                    cy = int(M["m01"] / M["m00"])
                    
                    # ラベルを描画
                    draw.text((cx-30, cy-15), room_names[i], 
                             fill=self.text_color, font=font)
        
        return pil_image
    
    def process_floor_plan(self, input_path, output_path):
        """間取り図の全体処理"""
        print(f"間取り図を処理中: {input_path}")
        
        # PDFから画像を抽出
        if input_path.lower().endswith('.pdf'):
            image = self.pdf_to_image(input_path)
            if image is None:
                return False
        else:
            image = Image.open(input_path)
        
        # 画像の前処理
        enhanced, edges = self.enhance_image(image)
        
        # 部屋の検出
        room_contours = self.detect_rooms(enhanced, edges)
        print(f"検出された部屋数: {len(room_contours)}")
        
        # カラー化
        colored_image = self.colorize_rooms(enhanced, room_contours)
        
        # ラベル追加
        final_image = self.add_room_labels(colored_image, room_contours)
        
        # 保存
        final_image.save(output_path, 'PNG', dpi=(300, 300))
        print(f"カラー化された間取り図を保存: {output_path}")
        
        return True

def main():
    colorizer = FloorPlanColorizer()
    
    # 入力ファイル（PDFまたは画像）
    input_file = "floor_plan.pdf"  # アップロードされたPDFファイル名
    output_file = "colorized_floor_plan.png"
    
    if not os.path.exists(input_file):
        print(f"入力ファイルが見つかりません: {input_file}")
        print("PDFファイルをこのスクリプトと同じディレクトリに配置してください。")
        return
    
    # 処理実行
    success = colorizer.process_floor_plan(input_file, output_file)
    
    if success:
        print("✅ 間取り図のカラー化が完了しました！")
        print(f"出力ファイル: {output_file}")
    else:
        print("❌ 処理に失敗しました。")

if __name__ == "__main__":
    main()