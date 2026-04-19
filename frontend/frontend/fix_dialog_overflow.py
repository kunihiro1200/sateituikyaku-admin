#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
WorkTaskDetailModal.tsx スクロールバグ根本修正

真の原因:
fullScreen Dialog では Dialog の Paper 要素が overflow: auto になっており、
DialogTitle + DialogContent + DialogActions 全体がスクロール可能。
ボタンクリック後の再マウントで React がコンポーネントを再描画する際、
DialogActions（保存ボタン）方向へ自動スクロールが発生する。

解決策:
Dialog の PaperProps に overflow: hidden を設定し、
DialogContent に flex: 1 と overflow: auto を設定することで、
スクロールを DialogContent 内に閉じ込める。
これにより DialogActions は常に画面下部に固定され、
スクロールが発生しなくなる。
"""

with open('src/components/WorkTaskDetailModal.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# ============================================================
# 修正1: Dialog に PaperProps を追加して overflow: hidden にする
# ============================================================

old_dialog = '<Dialog open={open} onClose={onClose} fullScreen>'
new_dialog = """<Dialog
          open={open}
          onClose={onClose}
          fullScreen
          PaperProps={{ sx: { display: 'flex', flexDirection: 'column', overflow: 'hidden' } }}
        >"""

if old_dialog in text:
    text = text.replace(old_dialog, new_dialog)
    print("✅ Dialog に PaperProps を追加しました")
else:
    print("⚠️  Dialog のパターンが見つかりません")
    idx = text.find('Dialog open={open}')
    if idx >= 0:
        print(f"  現在: {repr(text[idx:idx+80])}")

# ============================================================
# 修正2: DialogContent を flex: 1 + overflow: auto にする
# サイト登録タブ以外（媒介契約・契約決済・司法書士）は
# DialogContent 自体がスクロールコンテナになる
# サイト登録タブは内部の左右ペインが独立スクロールコンテナ
# ============================================================

old_dc = """<DialogContent sx={{ p: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>"""
new_dc = """<DialogContent sx={{ p: 0, flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', minHeight: 0 }}>"""

if old_dc in text:
    text = text.replace(old_dc, new_dc)
    print("✅ DialogContent の sx を修正しました（flex: 1, overflow: auto）")
else:
    print("⚠️  DialogContent のパターンが見つかりません")
    idx = text.find('DialogContent sx=')
    if idx >= 0:
        print(f"  現在: {repr(text[idx:idx+120])}")

# ============================================================
# 修正3: SiteRegistrationSection の外側 Box に flex: 1 と minHeight: 0 を追加
# これにより左右ペインが DialogContent の残り高さを占める
# ============================================================

old_site_outer = """    <Box sx={{ display: 'flex', gap: 0, height: '100%', overflow: 'hidden' }}>"""
new_site_outer = """    <Box sx={{ display: 'flex', gap: 0, flex: 1, minHeight: 0, overflow: 'hidden' }}>"""

if old_site_outer in text:
    text = text.replace(old_site_outer, new_site_outer)
    print("✅ SiteRegistrationSection 外側 Box を修正しました")
else:
    print("⚠️  SiteRegistrationSection 外側 Box のパターンが見つかりません")
    idx = text.find("display: 'flex', gap: 0")
    if idx >= 0:
        print(f"  現在: {repr(text[idx-10:idx+100])}")

# UTF-8 (BOMなし) で書き込む
with open('src/components/WorkTaskDetailModal.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print("\n✅ ファイルを UTF-8 (BOMなし) で保存しました")

# BOM チェック
with open('src/components/WorkTaskDetailModal.tsx', 'rb') as f:
    first3 = f.read(3)
print(f"BOM チェック: {repr(first3)}")
