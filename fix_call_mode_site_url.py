#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CallModePage.tsx のコメントフィールド周辺を変更する。
- コメントフィールドのコンテナを横並びレイアウトに変更
- seller.site === 'ウ' && seller.siteUrl && seller.siteUrl.trim() !== '' の条件でリンクを表示
- <a> タグで target="_blank" rel="noopener noreferrer" を設定
- リンクのラベルは「サイトURL」
"""

import sys

FILE_PATH = 'frontend/frontend/src/pages/CallModePage.tsx'

# 変更前の文字列
OLD_STR = '''            {/* コメント入力・編集エリア（直接書き込み可能） */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                コメント
              </Typography>
              <RichTextCommentEditor
                ref={commentEditorRef}
                value={editableComments}
                onChange={(html) => setEditableComments(html)}
                placeholder="コメントを入力してください..."
              />
            </Box>'''

# 変更後の文字列
NEW_STR = '''            {/* コメント入力・編集エリア（直接書き込み可能） */}
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="subtitle2">
                  コメント
                </Typography>
                {/* サイトURLリンク（inquiry_site が「ウ」かつ siteUrl が存在する場合のみ表示） */}
                {seller.site === 'ウ' && seller.siteUrl && seller.siteUrl.trim() !== '' && (
                  <a
                    href={seller.siteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: '0.85rem', color: '#1976d2', textDecoration: 'underline' }}
                  >
                    サイトURL
                  </a>
                )}
              </Box>
              <RichTextCommentEditor
                ref={commentEditorRef}
                value={editableComments}
                onChange={(html) => setEditableComments(html)}
                placeholder="コメントを入力してください..."
              />
            </Box>'''

def main():
    with open(FILE_PATH, 'rb') as f:
        content = f.read()

    text = content.decode('utf-8')

    if OLD_STR not in text:
        print('ERROR: 変更前の文字列が見つかりませんでした。')
        print('--- 検索文字列 ---')
        print(repr(OLD_STR[:100]))
        sys.exit(1)

    new_text = text.replace(OLD_STR, NEW_STR, 1)

    with open(FILE_PATH, 'wb') as f:
        f.write(new_text.encode('utf-8'))

    print('OK: CallModePage.tsx を正常に更新しました。')

if __name__ == '__main__':
    main()
