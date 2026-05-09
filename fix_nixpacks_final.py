# -*- coding: utf-8 -*-
"""
nixpacks.tomlを修正してRailwayデプロイを成功させる
playwright install-depsを削除し、必要な依存関係のみをインストール
"""

nixpacks_content = """[phases.setup]
nixPkgs = ["python311", "chromium"]

[phases.install]
cmds = [
  "pip install --upgrade pip",
  "pip install -r requirements.txt",
  "playwright install chromium --with-deps"
]

[start]
cmd = "python scrape_server.py"
"""

# C:\Users\kunih\sateituikyaku-scrape-serverのnixpacks.tomlを更新
with open('C:\\Users\\kunih\\sateituikyaku-scrape-server\\nixpacks.toml', 'w', encoding='utf-8') as f:
    f.write(nixpacks_content)

print('✅ nixpacks.toml を修正しました')
print('変更内容:')
print('- gcc, g++ を削除（nixパッケージのchromiumを使用）')
print('- playwright install-deps を --with-deps に変更')
print('- これにより、Playwrightが自動的に必要な依存関係をインストール')
