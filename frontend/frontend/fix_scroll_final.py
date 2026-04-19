#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
WorkTaskDetailModal.tsx スクロールバグ根本修正
インラインコンポーネントを外部化して再マウントを防止する

アプローチ:
- getValue, handleFieldChange などを props として渡す「共通 props」型を定義
- EditableField, EditableButtonSelect, EditableYesNo, ReadOnlyDisplayField,
  SectionHeader, RedNote を WorkTaskDetailModal の外部に移動
- SiteRegistrationSection, MediationSection, ContractSettlementSection,
  JudicialScrivenerSection も外部化
"""

with open('src/components/WorkTaskDetailModal.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# ============================================================
# 修正1: WorkTaskDetailModal 内の全インラインコンポーネントを
# モーダル外部に移動する
#
# 共通 props インターフェースを定義:
# interface FieldProps {
#   getValue: (field: string) => any;
#   handleFieldChange: (field: string, value: any) => void;
# }
#
# 各コンポーネントに FieldProps を追加する
# ============================================================

# まず現在のファイルを読み込んで、インラインコンポーネント部分を特定
lines = text.split('\n')

# WorkTaskDetailModal 関数の開始行を見つける
modal_start = None
for i, line in enumerate(lines):
    if 'export default function WorkTaskDetailModal' in line:
        modal_start = i
        break

print(f"WorkTaskDetailModal 開始行: {modal_start + 1}")

# ============================================================
# 修正アプローチ: 
# インラインコンポーネントを外部化する代わりに、
# より確実な方法として DialogContent の scroll behavior を制御する
#
# MUI の DialogContent はデフォルトで scroll-behavior が設定されており、
# 子要素がフォーカスを受け取ると自動スクロールする。
# これを防ぐには:
# 1. DialogContent に overflowY: 'hidden' を設定し、
#    内部の SiteRegistrationSection の左右ペインで独立スクロールさせる
# 2. または、ボタンの onClick で e.preventDefault() を呼ぶ
# 3. または、DialogContent に tabIndex={-1} を設定してフォーカス管理を無効化
#
# 最も確実な方法: DialogContent の overflow を hidden にして
# SiteRegistrationSection 内でスクロールを管理する
# ============================================================

# 現在の DialogContent の設定を確認
for i, line in enumerate(lines):
    if 'DialogContent' in line and 'ref=' in line:
        print(f"行{i+1}: {line.strip()}")

# DialogContent の sx を修正して overflow: hidden にする
# 現在: <DialogContent ref={dialogContentRef} sx={{ minHeight: 400 }}>
# 修正後: <DialogContent ref={dialogContentRef} sx={{ p: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

old_dialog_content = '<DialogContent ref={dialogContentRef} sx={{ minHeight: 400 }}>'
new_dialog_content = '<DialogContent ref={dialogContentRef} sx={{ p: 0, overflow: \'hidden\', display: \'flex\', flexDirection: \'column\' }}>'

if old_dialog_content in text:
    text = text.replace(old_dialog_content, new_dialog_content)
    print("✅ DialogContent の sx を修正しました")
else:
    print("⚠️  DialogContent のパターンが見つかりません")
    # 現在のパターンを確認
    for i, line in enumerate(lines):
        if 'DialogContent ref=' in line:
            print(f"  現在: 行{i+1}: {repr(line.strip())}")

# SiteRegistrationSection の左右ペインに height: '100%' を追加して
# 親の高さを埋めるようにする
# 左側 Box: overflowY: 'auto' は既にある
# 右側 Box: overflowY: 'auto' は既にある
# これらに flex: 1 と minHeight: 0 を追加する

# 左側 Box の修正
old_left_box = "      <Box sx={{ flex: 1, p: 2, borderRight: '2px solid', borderColor: 'divider', overflowY: 'auto' }}>"
new_left_box = "      <Box sx={{ flex: 1, p: 2, borderRight: '2px solid', borderColor: 'divider', overflowY: 'auto', minHeight: 0 }}>"

if old_left_box in text:
    text = text.replace(old_left_box, new_left_box)
    print("✅ 左側 Box に minHeight: 0 を追加しました")
else:
    print("⚠️  左側 Box のパターンが見つかりません")

# 右側 Box の修正
old_right_box = "      <Box sx={{ flex: 1, p: 2, overflowY: 'auto' }}>"
new_right_box = "      <Box sx={{ flex: 1, p: 2, overflowY: 'auto', minHeight: 0 }}>"

if old_right_box in text:
    text = text.replace(old_right_box, new_right_box)
    print("✅ 右側 Box に minHeight: 0 を追加しました")
else:
    print("⚠️  右側 Box のパターンが見つかりません")

# SiteRegistrationSection の外側 Box に height: '100%' を追加
old_site_box = "    <Box sx={{ display: 'flex', gap: 0, height: '100%' }}>"
new_site_box = "    <Box sx={{ display: 'flex', gap: 0, height: '100%', overflow: 'hidden' }}>"

if old_site_box in text:
    text = text.replace(old_site_box, new_site_box)
    print("✅ SiteRegistrationSection の外側 Box に overflow: hidden を追加しました")
else:
    print("⚠️  SiteRegistrationSection の外側 Box のパターンが見つかりません")

# ローディング/エラー表示の Box も flex: 1 にする
old_loading_box = "            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>\n              <CircularProgress />"
new_loading_box = "            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>\n              <CircularProgress />"

if old_loading_box in text:
    text = text.replace(old_loading_box, new_loading_box)
    print("✅ ローディング Box を修正しました")

old_nodata_box = "            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>\n              <Typography color=\"text.secondary\">データが見つかりません</Typography>"
new_nodata_box = "            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>\n              <Typography color=\"text.secondary\">データが見つかりません</Typography>"

if old_nodata_box in text:
    text = text.replace(old_nodata_box, new_nodata_box)
    print("✅ データなし Box を修正しました")

# UTF-8 (BOMなし) で書き込む
with open('src/components/WorkTaskDetailModal.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print("\n✅ ファイルを UTF-8 (BOMなし) で保存しました")

# BOM チェック
with open('src/components/WorkTaskDetailModal.tsx', 'rb') as f:
    first3 = f.read(3)
print(f"BOM チェック: {repr(first3)}")
