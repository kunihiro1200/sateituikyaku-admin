"""
福岡市 R8（2026年4月1日）通学区域PDF テキスト抽出
pdfminer.six を使用（有料API不使用）
"""
import sys
import os
from pdfminer.high_level import extract_text

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    tmp_dir = os.path.join(script_dir, '..', 'tmp-pdf')
    
    files = {
        'R8gakkoubetu.pdf': '学校別通学区域一覧',
        'R8choumeibetu.pdf': '町名別通学区域一覧'
    }
    
    for filename, label in files.items():
        pdf_path = os.path.join(tmp_dir, filename)
        txt_path = pdf_path.replace('.pdf', '.txt')
        
        print(f'\n=== {label} ({filename}) ===')
        try:
            text = extract_text(pdf_path)
            print(f'テキスト長: {len(text)} 文字')
            print('--- 先頭2000文字 ---')
            print(text[:2000])
            
            with open(txt_path, 'w', encoding='utf-8') as f:
                f.write(text)
            print(f'\n→ 保存: {txt_path}')
        except Exception as e:
            print(f'エラー: {e}', file=sys.stderr)

if __name__ == '__main__':
    main()
