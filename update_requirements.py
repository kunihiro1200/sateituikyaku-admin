# -*- coding: utf-8 -*-
"""
requirements.txtを更新してgreenletを明示的に追加
"""

requirements_content = """playwright==1.42.0
playwright-stealth==1.0.6
beautifulsoup4==4.12.3
lxml==5.1.0
greenlet==3.0.3
"""

# C:\Users\kunih\sateituikyaku-scrape-serverのrequirements.txtを更新
with open('C:\\Users\\kunih\\sateituikyaku-scrape-server\\requirements.txt', 'w', encoding='utf-8') as f:
    f.write(requirements_content)

print('✅ requirements.txt を更新しました')
print('変更内容:')
print('- greenlet==3.0.3 を追加（playwrightの依存関係）')
