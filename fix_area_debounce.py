"""
desired_area の保存をデバウンスして、複数選択時の上書き問題を修正する。
- UIは即時更新（selectedAreas）
- API保存は500ms後に最後の値だけ送る
"""

filepath = 'frontend/frontend/src/pages/BuyerDesiredConditionsPage.tsx'

with open(filepath, 'rb') as f:
    text = f.read().decode('utf-8')

# 1. useRef を import に追加
old_import = "import { useState, useEffect } from 'react';"
new_import = "import { useState, useEffect, useRef, useCallback } from 'react';"

if old_import in text:
    text = text.replace(old_import, new_import, 1)
    print('✅ useRef, useCallback を import に追加しました')
else:
    print('❌ import パターンが見つかりませんでした')

# 2. selectedAreas state の後にデバウンス用 ref を追加
old_state = "  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);"
new_state = """  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  // エリア保存のデバウンス用タイマー ref
  const areaSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);"""

if old_state in text:
    text = text.replace(old_state, new_state, 1)
    print('✅ areaSaveTimerRef を追加しました')
else:
    print('❌ state パターンが見つかりませんでした')

# 3. デバウンス保存関数を handleInlineFieldSave の前に追加
old_before_save = "  const handleInlineFieldSave = async (fieldName: string, newValue: any) => {"
new_before_save = """  // エリア選択をデバウンスして保存（500ms後に最後の値だけ送る）
  const saveAreasDebounced = useCallback((areas: string[]) => {
    if (areaSaveTimerRef.current) {
      clearTimeout(areaSaveTimerRef.current);
    }
    areaSaveTimerRef.current = setTimeout(() => {
      handleInlineFieldSave('desired_area', areas.join('、'));
    }, 500);
  }, []);

  const handleInlineFieldSave = async (fieldName: string, newValue: any) => {"""

if old_before_save in text:
    text = text.replace(old_before_save, new_before_save, 1)
    print('✅ saveAreasDebounced 関数を追加しました')
else:
    print('❌ handleInlineFieldSave パターンが見つかりませんでした')

# 4. Select の onChange でデバウンス保存を使う
old_onchange = """                      onChange={(e) => {
                        const selected = e.target.value as string[];
                        // UIを即時更新
                        setSelectedAreas(selected);
                        // APIに非同期保存
                        handleInlineFieldSave(field.key, selected.join('、'));
                      }}"""

new_onchange = """                      onChange={(e) => {
                        const selected = e.target.value as string[];
                        // UIを即時更新
                        setSelectedAreas(selected);
                        // APIに500msデバウンスして保存（連続選択時の上書き防止）
                        saveAreasDebounced(selected);
                      }}"""

if old_onchange in text:
    text = text.replace(old_onchange, new_onchange, 1)
    print('✅ onChange をデバウンス保存に変更しました')
else:
    print('❌ onChange パターンが見つかりませんでした')

# 5. Chip の onDelete もデバウンス保存を使う
old_chip_delete = """                                onDelete={(e) => {
                                  e.stopPropagation();
                                  const next = selectedAreas.filter((v) => v !== val);
                                  setSelectedAreas(next);
                                  handleInlineFieldSave(field.key, next.join('、'));
                                }}"""

new_chip_delete = """                                onDelete={(e) => {
                                  e.stopPropagation();
                                  const next = selectedAreas.filter((v) => v !== val);
                                  setSelectedAreas(next);
                                  saveAreasDebounced(next);
                                }}"""

if old_chip_delete in text:
    text = text.replace(old_chip_delete, new_chip_delete, 1)
    print('✅ Chip onDelete をデバウンス保存に変更しました')
else:
    print('❌ Chip onDelete パターンが見つかりませんでした')

with open(filepath, 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ ファイルを保存しました')
with open(filepath, 'rb') as f:
    print(f'BOM check: {repr(f.read(3))}')
