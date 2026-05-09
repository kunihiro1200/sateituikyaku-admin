# -*- coding: utf-8 -*-
"""
nixpacks.tomlを修正してplaywright installをスキップ
nixパッケージのchromiumを使用
"""

nixpacks_content = """[phases.setup]
nixPkgs = ["python311", "chromium", "nss", "freetype", "harfbuzz", "ca-certificates", "ttf-freefont", "fontconfig"]

[phases.install]
cmds = [
  "pip install --upgrade pip",
  "pip install -r requirements.txt"
]

[start]
cmd = "PLAYWRIGHT_BROWSERS_PATH=0 python scrape_server.py"
"""

# C:\Users\kunih\sateituikyaku-scrape-serverのnixpacks.tomlを更新
with open('C:\\Users\\kunih\\sateituikyaku-scrape-server\\nixpacks.toml', 'w', encoding='utf-8') as f:
    f.write(nixpacks_content)

print('✅ nixpacks.toml を修正しました')
print('変更内容:')
print('- playwright install を完全に削除')
print('- nixパッケージのchromiumと必要なフォントライブラリを追加')
print('- PLAYWRIGHT_BROWSERS_PATH=0 でシステムのchromiumを使用')
