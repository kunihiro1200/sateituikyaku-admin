#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
mergeMultipleProperties と mergePlaceholders の escaped 行を修正する
"""
import re

with open('backend/src/services/EmailTemplateService.ts', 'rb') as f:
    content = f.read().decode('utf-8')

# UUID に化けた部分を正しい文字列に戻す
# パターン: .replace(/[.*+?^${}()|[\]\\]/g, '\\<UUID>')
fixed = re.sub(
    r"placeholder\.replace\(/\[\.\*\+\?\\^\$\{\}\(\)\|\[\\\\]\\\\/g, '\\\\[0-9a-f-]+'\)",
    r"placeholder.replace(/[.*+?^${}()|[\\\\]\\\\]/g, '\\\\$&')",
    content
)

# より単純なパターンで置換
fixed2 = re.sub(
    r"'\\\\[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'",
    r"'\\\\$&'",
    content
)

if fixed2 != content:
    content = fixed2
    print('UUID を \\$& に修正しました')
else:
    print('パターンが見つかりません。手動確認が必要です')
    # デバッグ: UUID パターンを探す
    matches = re.findall(r"'\\\\[0-9a-f-]+'", content)
    print(f'見つかったパターン: {matches}')

with open('backend/src/services/EmailTemplateService.ts', 'wb') as f:
    f.write(content.encode('utf-8'))

print('完了')
