"""
デバウンス方式をやめて、ドロップダウンを閉じた時(onClose)に保存する方式に変更。
これでページ離脱前に確実に保存される。
"""

filepath = 'frontend/frontend/src/pages/BuyerDesiredConditionsPage.tsx'

with open(filepath, 'rb') as f:
    text = f.read().decode('utf-8')

# 1. useRef, useCallback を削除（不要になる）
old_import = "import { useState, useEffect, useRef, useCallback } from 'react';"
new_import = "import { useState, useEffect, useRef } from 'react';"

if old_import in text:
    text = text.replace(old_import, new_import, 1)
    print('✅ useCallback を import から削除しました')
else:
    print('❌ import パターンが見つかりませんでした')

# 2. areaSaveTimerRef を pendingAreasRef に変更（保存待ちの値を保持）
old_ref = """  // エリア保存のデバウンス用タイマー ref
  const areaSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);"""
new_ref = """  // ドロップダウンを閉じた時に保存する値を保持する ref
  const pendingAreasRef = useRef<string[] | null>(null);"""

if old_ref in text:
    text = text.replace(old_ref, new_ref, 1)
    print('✅ areaSaveTimerRef を pendingAreasRef に変更しました')
else:
    print('❌ ref パターンが見つかりませんでした')

# 3. saveAreasDebounced 関数を削除して saveAreasPending に変更
old_debounce = """  // エリア選択をデバウンスして保存（500ms後に最後の値だけ送る）
  const saveAreasDebounced = useCallback((areas: string[]) => {
    if (areaSaveTimerRef.current) {
      clearTimeout(areaSaveTimerRef.current);
    }
    areaSaveTimerRef.current = setTimeout(() => {
      handleInlineFieldSave('desired_area', areas.join('、'));
    }, 500);
  }, []);

  const handleInlineFieldSave"""
new_debounce = """  const handleInlineFieldSave"""

if old_debounce in text:
    text = text.replace(old_debounce, new_debounce, 1)
    print('✅ saveAreasDebounced 関数を削除しました')
else:
    print('❌ debounce 関数パターンが見つかりませんでした')

# 4. Select の onChange: UIのみ更新、保存は onClose で行う
old_onchange = """                      onChange={(e) => {
                        const selected = e.target.value as string[];
                        // UIを即時更新
                        setSelectedAreas(selected);
                        // APIに500msデバウンスして保存（連続選択時の上書き防止）
                        saveAreasDebounced(selected);
                      }}"""
new_onchange = """                      onChange={(e) => {
                        const selected = e.target.value as string[];
                        // UIを即時更新
                        setSelectedAreas(selected);
                        // 保存待ち値を ref に保持（onClose で保存）
                        pendingAreasRef.current = selected;
                      }}
                      onClose={() => {
                        // ドロップダウンを閉じた時に保存（変更があった場合のみ）
                        if (pendingAreasRef.current !== null) {
                          handleInlineFieldSave(field.key, pendingAreasRef.current.join('、'));
                          pendingAreasRef.current = null;
                        }
                      }}"""

if old_onchange in text:
    text = text.replace(old_onchange, new_onchange, 1)
    print('✅ onChange を onClose 保存方式に変更しました')
else:
    print('❌ onChange パターンが見つかりませんでした')

# 5. Chip の onDelete: 即時保存（ドロップダウン外なので直接保存）
old_chip = """                                onDelete={(e) => {
                                  e.stopPropagation();
                                  const next = selectedAreas.filter((v) => v !== val);
                                  setSelectedAreas(next);
                                  saveAreasDebounced(next);
                                }}"""
new_chip = """                                onDelete={(e) => {
                                  e.stopPropagation();
                                  const next = selectedAreas.filter((v) => v !== val);
                                  setSelectedAreas(next);
                                  // チップ削除は即時保存
                                  handleInlineFieldSave(field.key, next.join('、'));
                                }}"""

if old_chip in text:
    text = text.replace(old_chip, new_chip, 1)
    print('✅ Chip onDelete を即時保存に変更しました')
else:
    print('❌ Chip onDelete パターンが見つかりませんでした')

with open(filepath, 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ ファイルを保存しました')
with open(filepath, 'rb') as f:
    print(f'BOM check: {repr(f.read(3))}')
