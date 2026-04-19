#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
WorkTaskDetailModal.tsx スクロールバグ根本修正 - flushSync アプローチ

問題: useEffect でのスクロール復元が React の再マウント後のスクロールリセットに
     負けている。

解決策: flushSync を使って state 更新を同期的に行い、
        その直後にスクロール位置を復元する。
        これにより React の再レンダリング完了直後にスクロールが復元される。

または: インラインコンポーネントを全て外部化する（根本解決）
"""

with open('src/components/WorkTaskDetailModal.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# ============================================================
# 修正: flushSync を使った同期的スクロール復元
# 
# import { flushSync } from 'react-dom'; を追加
# handleFieldChange を flushSync で包む
# ============================================================

# 1. react-dom から flushSync をインポート
old_import = "import { useState, useEffect, useRef } from 'react';"
new_import = "import { useState, useEffect, useRef } from 'react';\nimport { flushSync } from 'react-dom';"

if old_import in text:
    text = text.replace(old_import, new_import)
    print("✅ flushSync のインポートを追加しました")
else:
    print("⚠️  import 文のパターンが見つかりません")
    # 現在のインポートを確認
    for line in text.split('\n')[:5]:
        print(f"  {repr(line)}")

# 2. handleFieldChange を flushSync で包む
old_handle = """  const handleFieldChange = (field: string, value: any) => {
    // フィールド変更前にスクロール位置を保存
    scrollPositionRef.current = dialogContentRef.current?.scrollTop ?? 0;
    setEditedData(prev => ({ ...prev, [field]: value }));"""

new_handle = """  const handleFieldChange = (field: string, value: any) => {
    // フィールド変更前にスクロール位置を保存
    scrollPositionRef.current = dialogContentRef.current?.scrollTop ?? 0;
    // flushSync で同期的に state 更新し、直後にスクロール位置を復元
    flushSync(() => {
      setEditedData(prev => ({ ...prev, [field]: value }));
    });
    // 同期的に復元（flushSync 後は DOM が更新済み）
    if (dialogContentRef.current) {
      dialogContentRef.current.scrollTop = scrollPositionRef.current;
    }"""

if old_handle in text:
    text = text.replace(old_handle, new_handle)
    print("✅ handleFieldChange を flushSync で修正しました")
else:
    print("⚠️  handleFieldChange のパターンが見つかりません")
    idx = text.find('handleFieldChange = (field: string, value: any)')
    if idx >= 0:
        print(f"  現在のパターン: {repr(text[idx:idx+300])}")

# 3. useEffect でのスクロール復元は不要になるので削除（または条件を厳しくする）
old_effect = """  // editedData 変更後にスクロール位置を復元（依存配列を指定して毎レンダリング実行を防ぐ）
  useEffect(() => {
    if (dialogContentRef.current && scrollPositionRef.current > 0) {
      dialogContentRef.current.scrollTop = scrollPositionRef.current;
    }
  }, [editedData]);"""

new_effect = """  // flushSync で同期的に復元しているため useEffect での復元は不要
  // （念のため残しておくが、通常は flushSync 側で処理される）"""

if old_effect in text:
    text = text.replace(old_effect, new_effect)
    print("✅ useEffect のスクロール復元を削除しました（flushSync で代替）")
else:
    # 元の useEffect パターンも試す
    old_effect2 = """  // レンダリング後にスクロール位置を復元
  useEffect(() => {
    if (dialogContentRef.current) {
      dialogContentRef.current.scrollTop = scrollPositionRef.current;
    }
  });"""
    if old_effect2 in text:
        text = text.replace(old_effect2, new_effect)
        print("✅ useEffect のスクロール復元を削除しました（元パターン）")
    else:
        print("⚠️  useEffect のパターンが見つかりません")
        idx = text.find('scrollPositionRef.current')
        if idx >= 0:
            print(f"  現在のパターン: {repr(text[max(0,idx-100):idx+200])}")

# UTF-8 (BOMなし) で書き込む
with open('src/components/WorkTaskDetailModal.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print("\n✅ ファイルを UTF-8 (BOMなし) で保存しました")

# BOM チェック
with open('src/components/WorkTaskDetailModal.tsx', 'rb') as f:
    first3 = f.read(3)
print(f"BOM チェック: {repr(first3)}")
