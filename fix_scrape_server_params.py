# -*- coding: utf-8 -*-
# scrape_server.pyのdo_POSTメソッドとsave_to_supabase呼び出しを修正

import sys

# scrape_server.pyを読み込む
with open('C:/Users/kunih/sateituikyaku-scrape-server/scrape_server.py', 'r', encoding='utf-8') as f:
    content = f.read()

# 修正1: do_POSTメソッドでprocess_imagesをprocess_images_flagに変更
old_do_post = '''        is_tateuri = req_data.get('is_tateuri', False)  # 建売専門HP用フラグ
        process_images = req_data.get('process_images', False)  # 画像加工フラグ'''

new_do_post = '''        region = req_data.get('region', 'oita')  # regionパラメータを取得
        process_images_flag = req_data.get('process_images', False)  # 画像加工フラグ'''

content = content.replace(old_do_post, new_do_post)

# 修正2: print文を修正
old_print = '''            print(f'[scrape] リクエスト受信: {url} (is_tateuri={is_tateuri}, process_images={process_images})')'''

new_print = '''            print(f'[scrape] リクエスト受信: {url} (region={region}, process_images={process_images_flag})')'''

content = content.replace(old_print, new_print)

# 修正3: save_to_supabase呼び出しを修正
old_save = '''            slug = save_to_supabase(data, is_tateuri=is_tateuri, process_images=process_images)'''

new_save = '''            slug = save_to_supabase(data, region=region, process_images_flag=process_images_flag)'''

content = content.replace(old_save, new_save)

# 保存
with open('C:/Users/kunih/sateituikyaku-scrape-server/scrape_server.py', 'w', encoding='utf-8') as f:
    f.write(content)

print('✅ scrape_server.py を修正しました')
print('次のステップ:')
print('1. C:/Users/kunih/sateituikyaku-scrape-server ディレクトリで以下を実行:')
print('   git add scrape_server.py')
print('   git commit -m "fix: Fix process_images parameter handling"')
print('   git push')
print('2. Railwayが自動デプロイするのを待つ')
