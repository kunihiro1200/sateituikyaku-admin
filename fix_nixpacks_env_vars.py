# -*- coding: utf-8 -*-
"""
nixpacks.tomlに環境変数を追加してPlaywrightのブラウザインストールを無効化
"""

nixpacks_content = """[phases.setup]
nixPkgs = ["python311", "chromium", "nss", "freetype", "harfbuzz", "ca-certificates", "fontconfig"]

[phases.install]
cmds = [
  "pip install --upgrade pip",
  "pip install -r requirements.txt"
]

[start]
cmd = "python scrape_server.py"

[variables]
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = "1"
PLAYWRIGHT_BROWSERS_PATH = "/nix/store"
"""

# C:\Users\kunih\sateituikyaku-scrape-serverのnixpacks.tomlを更新
with open('C:\\Users\\kunih\\sateituikyaku-scrape-server\\nixpacks.toml', 'w', encoding='utf-8') as f:
    f.write(nixpacks_content)

print('✅ nixpacks.toml を修正しました')
print('変更内容:')
print('- PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 を追加（ブラウザダウンロードをスキップ）')
print('- PLAYWRIGHT_BROWSERS_PATH=/nix/store を追加（nixのchromiumを使用）')
