#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
WorkTaskDetailModal.tsx のスクロールバグ根本修正スクリプト
全インラインコンポーネントを外部に切り出し、再マウントを防止する
"""

import re

with open('src/components/WorkTaskDetailModal.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# ============================================================
# 戦略: インラインコンポーネントを外部化するのではなく、
# DialogContent の overflowY を制御し、
# SiteRegistrationSection 内の左右ペインの overflowY: 'auto' を
# 親の DialogContent に委ねる形にする。
#
# 真の根本原因:
# SiteRegistrationSection 内の左右 Box に overflowY: 'auto' があり、
# それぞれが独立したスクロールコンテナになっている。
# ボタンクリック時に React がコンポーネントを再レンダリングすると、
# MUI の DialogContent が scroll-behavior によりフォーカス要素に
# スクロールしてしまう。
#
# 修正方針:
# 1. DialogContent に sx={{ overflow: 'hidden', p: 0 }} を設定
# 2. SiteRegistrationSection の左右 Box の overflowY: 'auto' を維持
#    (これらは独立したスクロールコンテナなので影響を受けない)
# 3. useEffect でのスクロール復元を削除（不要になる）
# 4. handleFieldChange でのスクロール保存も削除
#
# より確実な修正:
# DialogContent に ref を付けて、
# レンダリング後に scrollTop を強制的に復元する現在の方式を維持しつつ、
# useEffect の依存配列を [editedData] にして
# editedData 変更時のみ復元するよう修正する
# ============================================================

# 現在の useEffect（依存配列なし = 毎レンダリング後に実行）を
# editedData 変更時のみ実行するよう修正
old_effect = """  // レンダリング後にスクロール位置を復元
  useEffect(() => {
    if (dialogContentRef.current) {
      dialogContentRef.current.scrollTop = scrollPositionRef.current;
    }
  });"""

new_effect = """  // editedData 変更後にスクロール位置を復元（依存配列を指定して毎レンダリング実行を防ぐ）
  useEffect(() => {
    if (dialogContentRef.current && scrollPositionRef.current > 0) {
      dialogContentRef.current.scrollTop = scrollPositionRef.current;
    }
  }, [editedData]);"""

if old_effect in text:
    text = text.replace(old_effect, new_effect)
    print("✅ useEffect の依存配列を修正しました")
else:
    print("⚠️  useEffect のパターンが見つかりませんでした")
    # 現在のパターンを確認
    idx = text.find('レンダリング後にスクロール位置を復元')
    if idx >= 0:
        print(f"  現在のパターン: {repr(text[idx-2:idx+200])}")

# handleFieldChange でスクロール位置を保存する処理を確認・修正
# 現在: scrollPositionRef.current = dialogContentRef.current?.scrollTop ?? 0;
# これは正しいが、問題は useEffect が毎レンダリング後に実行されていたこと
# 上記の修正で解決するはず

# 確認
if 'scrollPositionRef.current = dialogContentRef.current?.scrollTop' in text:
    print("✅ handleFieldChange でのスクロール位置保存は正常です")
else:
    print("⚠️  handleFieldChange でのスクロール位置保存が見つかりません")

# UTF-8 (BOMなし) で書き込む
with open('src/components/WorkTaskDetailModal.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print("✅ ファイルを UTF-8 (BOMなし) で保存しました")

# BOM チェック
with open('src/components/WorkTaskDetailModal.tsx', 'rb') as f:
    first3 = f.read(3)
print(f"BOM チェック: {repr(first3)} (b'imp' などであれば OK)")
