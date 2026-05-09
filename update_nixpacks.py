# -*- coding: utf-8 -*-
"""
nixpacks.tomlを更新してRailwayデプロイを修正
"""
import shutil

# C:\Users\kunih\sateituikyaku-scrape-serverのnixpacks.tomlを更新
nixpacks_content = """[phases.setup]
nixPkgs = ["python311", "chromium", "gcc", "g++"]

[phases.install]
cmds = [
  "pip install --upgrade pip",
  "pip install -r requirements.txt",
  "playwright install chromium",
  "playwright install-deps chromium"
]

[start]
cmd = "python scrape_server.py"
"""

# ファイルに書き込む
with open('C:\\Users\\kunih\\sateituikyaku-scrape-server\\nixpacks.toml', 'w', encoding='utf-8') as f:
    f.write(nixpacks_content)

print('✅ nixpacks.toml を更新しました')
print('変更内容:')
print('- Python 3.9 → Python 3.11')
print('- gcc, g++ を追加（greenletのビルドに必要）')
print('- pip を最新版にアップグレード')
