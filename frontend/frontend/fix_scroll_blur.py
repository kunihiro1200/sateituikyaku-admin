#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
WorkTaskDetailModal.tsx スクロールバグ根本修正 - blur アプローチ

真の原因:
ボタンクリック後、ブラウザがそのボタンにフォーカスを当てる。
MUI の DialogContent はフォーカスされた要素が見えるように自動スクロールする。
これが scrollTop 復元の後に発生するため、復元が無効化される。

解決策:
EditableButtonSelect と EditableYesNo の各ボタンの onClick で
e.currentTarget.blur() を呼び、クリック後にフォーカスを外す。
これによりブラウザの自動スクロールが発生しなくなる。
"""

with open('src/components/WorkTaskDetailModal.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# ============================================================
# 修正1: EditableButtonSelect のボタンに blur を追加
# ============================================================

old_button_select = """        <ButtonGroup size="small" variant="outlined">
          {options.map((opt) => (
            <Button
              key={opt}
              variant={getValue(field) === opt ? 'contained' : 'outlined'}
              color={getValue(field) === opt ? 'primary' : 'inherit'}
              onClick={() => handleFieldChange(field, opt)}
            >
              {opt}
            </Button>
          ))}
        </ButtonGroup>"""

new_button_select = """        <ButtonGroup size="small" variant="outlined">
          {options.map((opt) => (
            <Button
              key={opt}
              variant={getValue(field) === opt ? 'contained' : 'outlined'}
              color={getValue(field) === opt ? 'primary' : 'inherit'}
              onClick={(e) => { (e.currentTarget as HTMLButtonElement).blur(); handleFieldChange(field, opt); }}
            >
              {opt}
            </Button>
          ))}
        </ButtonGroup>"""

if old_button_select in text:
    text = text.replace(old_button_select, new_button_select)
    print("✅ EditableButtonSelect に blur を追加しました")
else:
    print("⚠️  EditableButtonSelect のパターンが見つかりません")

# ============================================================
# 修正2: EditableYesNo の Y/N ボタンに blur を追加
# ============================================================

old_yn_buttons = """          <Button
            variant={getValue(field) === 'Y' ? 'contained' : 'outlined'}
            color={getValue(field) === 'Y' ? 'primary' : 'inherit'}
            onClick={() => handleFieldChange(field, getValue(field) === 'Y' ? null : 'Y')}
          >Y</Button>
          <Button
            variant={getValue(field) === 'N' ? 'contained' : 'outlined'}
            color={getValue(field) === 'N' ? 'inherit' : 'inherit'}
            onClick={() => handleFieldChange(field, getValue(field) === 'N' ? null : 'N')}
          >N</Button>"""

new_yn_buttons = """          <Button
            variant={getValue(field) === 'Y' ? 'contained' : 'outlined'}
            color={getValue(field) === 'Y' ? 'primary' : 'inherit'}
            onClick={(e) => { (e.currentTarget as HTMLButtonElement).blur(); handleFieldChange(field, getValue(field) === 'Y' ? null : 'Y'); }}
          >Y</Button>
          <Button
            variant={getValue(field) === 'N' ? 'contained' : 'outlined'}
            color={getValue(field) === 'N' ? 'inherit' : 'inherit'}
            onClick={(e) => { (e.currentTarget as HTMLButtonElement).blur(); handleFieldChange(field, getValue(field) === 'N' ? null : 'N'); }}
          >N</Button>"""

if old_yn_buttons in text:
    text = text.replace(old_yn_buttons, new_yn_buttons)
    print("✅ EditableYesNo に blur を追加しました")
else:
    print("⚠️  EditableYesNo のパターンが見つかりません")

# ============================================================
# 修正3: CadastralMapFieldSelect のボタンにも blur を追加
# ============================================================

old_cadastral = """            onClick={() => handleFieldChange('cadastral_map_field', opt)}"""
new_cadastral = """            onClick={(e) => { (e.currentTarget as HTMLButtonElement).blur(); handleFieldChange('cadastral_map_field', opt); }}"""

if old_cadastral in text:
    text = text.replace(old_cadastral, new_cadastral)
    print("✅ CadastralMapFieldSelect に blur を追加しました")
else:
    print("⚠️  CadastralMapFieldSelect のパターンが見つかりません")

# ============================================================
# 修正4: flushSync は不要になるので元に戻す（シンプルに）
# flushSync は React 18 では通常の setState で十分
# ============================================================

old_flush = """    // フィールド変更前にスクロール位置を保存
    scrollPositionRef.current = dialogContentRef.current?.scrollTop ?? 0;
    // flushSync で同期的に state 更新し、直後にスクロール位置を復元
    flushSync(() => {
      setEditedData(prev => ({ ...prev, [field]: value }));
    });
    // 同期的に復元（flushSync 後は DOM が更新済み）
    if (dialogContentRef.current) {
      dialogContentRef.current.scrollTop = scrollPositionRef.current;
    }"""

new_flush = """    setEditedData(prev => ({ ...prev, [field]: value }));"""

if old_flush in text:
    text = text.replace(old_flush, new_flush)
    print("✅ handleFieldChange をシンプルに戻しました（blur で解決するため）")
else:
    print("⚠️  flushSync パターンが見つかりません")

# flushSync のインポートも削除
old_import = """import { useState, useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';"""
new_import = """import { useState, useEffect, useRef } from 'react';"""

if old_import in text:
    text = text.replace(old_import, new_import)
    print("✅ flushSync のインポートを削除しました")

# dialogContentRef と scrollPositionRef も不要になるので削除
old_refs = """  // DialogContent の ref（スクロール位置保持用）
  const dialogContentRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef<number>(0);

  // flushSync で同期的に復元しているため useEffect での復元は不要
  // （念のため残しておくが、通常は flushSync 側で処理される）"""

new_refs = ""

if old_refs in text:
    text = text.replace(old_refs, new_refs)
    print("✅ 不要な ref を削除しました")
else:
    print("⚠️  ref パターンが見つかりません - 手動確認が必要")

# DialogContent の ref も削除
old_dc = """<DialogContent ref={dialogContentRef} sx={{ p: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>"""
new_dc = """<DialogContent sx={{ p: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>"""

if old_dc in text:
    text = text.replace(old_dc, new_dc)
    print("✅ DialogContent の ref を削除しました")
else:
    # 別パターンも試す
    old_dc2 = """<DialogContent ref={dialogContentRef} sx={{ minHeight: 400 }}>"""
    new_dc2 = """<DialogContent sx={{ minHeight: 400 }}>"""
    if old_dc2 in text:
        text = text.replace(old_dc2, new_dc2)
        print("✅ DialogContent の ref を削除しました（別パターン）")
    else:
        print("⚠️  DialogContent の ref パターンが見つかりません")
        # 現在のパターンを確認
        idx = text.find('DialogContent ref=')
        if idx >= 0:
            print(f"  現在: {repr(text[idx:idx+100])}")

# UTF-8 (BOMなし) で書き込む
with open('src/components/WorkTaskDetailModal.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print("\n✅ ファイルを UTF-8 (BOMなし) で保存しました")

# BOM チェック
with open('src/components/WorkTaskDetailModal.tsx', 'rb') as f:
    first3 = f.read(3)
print(f"BOM チェック: {repr(first3)}")
