#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
WorkTaskDetailModal.tsx スクロールバグ根本修正

真の原因（確定）:
SiteRegistrationSection の左右ペイン（overflowY: auto の Box）が
独立したスクロールコンテナになっている。
SiteRegistrationSection はモーダル内インライン定義のため、
editedData 更新のたびに再マウントされ、左右ペインの scrollTop がリセットされる。

解決策:
左右ペインに ref を付けて、handleFieldChange の前後で scrollTop を保存・復元する。
SiteRegistrationSection に leftPaneRef, rightPaneRef を props として渡す。
"""

with open('src/components/WorkTaskDetailModal.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# ============================================================
# 修正1: useRef を使って左右ペインの scrollTop を保持
# WorkTaskDetailModal のトップレベルに ref を追加
# ============================================================

# hasChanges の後に ref を追加
old_has_changes = "  const hasChanges = Object.keys(editedData).length > 0;"

new_has_changes = """  const hasChanges = Object.keys(editedData).length > 0;

  // サイト登録タブ左右ペインのスクロール位置保持用 ref
  const leftPaneRef = useRef<HTMLDivElement>(null);
  const rightPaneRef = useRef<HTMLDivElement>(null);
  const leftScrollRef = useRef<number>(0);
  const rightScrollRef = useRef<number>(0);"""

if old_has_changes in text:
    text = text.replace(old_has_changes, new_has_changes)
    print("✅ 左右ペイン ref を追加しました")
else:
    print("⚠️  hasChanges のパターンが見つかりません")

# ============================================================
# 修正2: handleFieldChange でスクロール位置を保存し、
# setState 後に復元する
# ============================================================

old_handle = """  const handleFieldChange = (field: string, value: any) => {
    setEditedData(prev => ({ ...prev, [field]: value }));"""

new_handle = """  const handleFieldChange = (field: string, value: any) => {
    // 左右ペインのスクロール位置を保存
    leftScrollRef.current = leftPaneRef.current?.scrollTop ?? 0;
    rightScrollRef.current = rightPaneRef.current?.scrollTop ?? 0;
    setEditedData(prev => ({ ...prev, [field]: value }));"""

if old_handle in text:
    text = text.replace(old_handle, new_handle)
    print("✅ handleFieldChange にスクロール保存を追加しました")
else:
    print("⚠️  handleFieldChange のパターンが見つかりません")
    idx = text.find('handleFieldChange = (field: string, value: any)')
    if idx >= 0:
        print(f"  現在: {repr(text[idx:idx+200])}")

# ============================================================
# 修正3: useEffect でスクロール位置を復元
# editedData が変わった後に復元する
# ============================================================

# hasChanges の後の ref 定義の後に useEffect を追加
old_refs_block = """  // サイト登録タブ左右ペインのスクロール位置保持用 ref
  const leftPaneRef = useRef<HTMLDivElement>(null);
  const rightPaneRef = useRef<HTMLDivElement>(null);
  const leftScrollRef = useRef<number>(0);
  const rightScrollRef = useRef<number>(0);"""

new_refs_block = """  // サイト登録タブ左右ペインのスクロール位置保持用 ref
  const leftPaneRef = useRef<HTMLDivElement>(null);
  const rightPaneRef = useRef<HTMLDivElement>(null);
  const leftScrollRef = useRef<number>(0);
  const rightScrollRef = useRef<number>(0);

  // editedData 変更後に左右ペインのスクロール位置を復元
  useEffect(() => {
    if (leftPaneRef.current) {
      leftPaneRef.current.scrollTop = leftScrollRef.current;
    }
    if (rightPaneRef.current) {
      rightPaneRef.current.scrollTop = rightScrollRef.current;
    }
  }, [editedData]);"""

if old_refs_block in text:
    text = text.replace(old_refs_block, new_refs_block)
    print("✅ useEffect でスクロール復元を追加しました")
else:
    print("⚠️  refs block のパターンが見つかりません")

# ============================================================
# 修正4: SiteRegistrationSection に leftPaneRef, rightPaneRef を props として渡す
# ============================================================

# SiteRegistrationSection の props 型を拡張
old_site_props = "  const SiteRegistrationSection = ({ cwCounts }: { cwCounts: CwCountData }) => {"
new_site_props = "  const SiteRegistrationSection = ({ cwCounts, leftPaneRef, rightPaneRef }: { cwCounts: CwCountData; leftPaneRef: React.RefObject<HTMLDivElement>; rightPaneRef: React.RefObject<HTMLDivElement> }) => {"

if old_site_props in text:
    text = text.replace(old_site_props, new_site_props)
    print("✅ SiteRegistrationSection の props 型を拡張しました")
else:
    print("⚠️  SiteRegistrationSection の props 型パターンが見つかりません")

# 左側 Box に ref を追加
old_left_box = "      <Box sx={{ flex: 1, p: 2, borderRight: '2px solid', borderColor: 'divider', overflowY: 'auto', minHeight: 0 }}>"
new_left_box = "      <Box ref={leftPaneRef} sx={{ flex: 1, p: 2, borderRight: '2px solid', borderColor: 'divider', overflowY: 'auto', minHeight: 0 }}>"

if old_left_box in text:
    text = text.replace(old_left_box, new_left_box)
    print("✅ 左側 Box に ref を追加しました")
else:
    print("⚠️  左側 Box のパターンが見つかりません")
    idx = text.find("borderRight: '2px solid'")
    if idx >= 0:
        print(f"  現在: {repr(text[idx-20:idx+100])}")

# 右側 Box に ref を追加
old_right_box = "      <Box sx={{ flex: 1, p: 2, overflowY: 'auto', minHeight: 0 }}>"
new_right_box = "      <Box ref={rightPaneRef} sx={{ flex: 1, p: 2, overflowY: 'auto', minHeight: 0 }}>"

if old_right_box in text:
    text = text.replace(old_right_box, new_right_box)
    print("✅ 右側 Box に ref を追加しました")
else:
    print("⚠️  右側 Box のパターンが見つかりません")
    idx = text.find("flex: 1, p: 2, overflowY: 'auto'")
    if idx >= 0:
        print(f"  現在: {repr(text[idx-20:idx+100])}")

# ============================================================
# 修正5: SiteRegistrationSection の呼び出し箇所に ref を渡す
# ============================================================

old_call = "{tabIndex === 1 && <SiteRegistrationSection cwCounts={cwCounts} />}"
new_call = "{tabIndex === 1 && <SiteRegistrationSection cwCounts={cwCounts} leftPaneRef={leftPaneRef} rightPaneRef={rightPaneRef} />}"

if old_call in text:
    text = text.replace(old_call, new_call)
    print("✅ SiteRegistrationSection の呼び出しに ref を追加しました")
else:
    print("⚠️  SiteRegistrationSection の呼び出しパターンが見つかりません")
    idx = text.find('SiteRegistrationSection cwCounts=')
    if idx >= 0:
        print(f"  現在: {repr(text[idx-5:idx+80])}")

# UTF-8 (BOMなし) で書き込む
with open('src/components/WorkTaskDetailModal.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print("\n✅ ファイルを UTF-8 (BOMなし) で保存しました")

with open('src/components/WorkTaskDetailModal.tsx', 'rb') as f:
    first3 = f.read(3)
print(f"BOM チェック: {repr(first3)}")
