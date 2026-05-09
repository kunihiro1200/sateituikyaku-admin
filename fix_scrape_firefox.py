# -*- coding: utf-8 -*-
"""
scrape_server.pyをFirefoxに変更し、playwright-stealthを削除する
"""

with open('scrape_server.py', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# playwright-stealthのインポートを削除
text = text.replace('from playwright_stealth import Stealth\n', '')

# Stealth().use_async(async_playwright())をasync_playwright()に変更
text = text.replace('async with Stealth().use_async(async_playwright()) as p:', 'async with async_playwright() as p:')

# chromium.launchをfirefox.launchに変更
old_launch = '''browser = await p.chromium.launch(headless=True)'''
new_launch = '''browser = await p.firefox.launch(headless=True)'''
text = text.replace(old_launch, new_launch)

# User-AgentをFirefox用に変更
old_ua = "'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'"
new_ua = "'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0'"
text = text.replace(old_ua, new_ua)

# UTF-8で書き込む
with open('scrape_server.py', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done! Firefox版に変更しました')
