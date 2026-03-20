with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 1. キャッシュヒット時のsetSeller後にeditableComments初期化を追加
old_cache_hit = '''            setSeller(freshData);
            setUnreachableStatus(freshData.unreachableStatus || null);
          }
        }).catch(() => {});'''

new_cache_hit = '''            setSeller(freshData);
            setUnreachableStatus(freshData.unreachableStatus || null);
            setEditableComments(freshData.comments || '');
          }
        }).catch(() => {});'''

if old_cache_hit in text:
    text = text.replace(old_cache_hit, new_cache_hit)
    print('✅ キャッシュヒット時のeditableComments初期化追加完了')
else:
    print('❌ キャッシュヒット時の対象が見つかりませんでした')

# 2. メインのsetSeller後にeditableComments初期化を追加
old_main_set = '''      setSeller(sellerData);
      setUnreachableStatus(sellerData.unreachableStatus || null);

      // 反響URLを非同期で取得'''

new_main_set = '''      setSeller(sellerData);
      setUnreachableStatus(sellerData.unreachableStatus || null);
      setEditableComments(sellerData.comments || '');

      // 反響URLを非同期で取得'''

if old_main_set in text:
    text = text.replace(old_main_set, new_main_set)
    print('✅ メインのeditableComments初期化追加完了')
else:
    print('❌ メインのsetSeller対象が見つかりませんでした')

with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
