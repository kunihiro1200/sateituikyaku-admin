#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
WorkTaskDetailModal.tsx の cadastral_map 関連フィールドを修正するスクリプト

タスク1: CadastralMapFieldSelect コンポーネントを追加
タスク2: SiteRegistrationSection の条件分岐ブロックを修正
"""

with open('frontend/frontend/src/components/WorkTaskDetailModal.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# ===== タスク1 & タスク2: 変更を適用 =====

# 変更前（現在の実装）
old_code = '''  // サイト登録セクション
  const SiteRegistrationSection = () => (
    <Box sx={{ p: 2 }}>
      <EditableField label="サイト登録締め日" field="site_registration_deadline" type="date" />
      <EditableField label="種別" field="property_type" />

      <SectionHeader label="【サイト登録依頼】" />
      <EditableField label="サイト備考" field="site_notes" />
      {getValue('property_type') === '土' && (
        <>
          <EditableField label="地籍測量図・字図（営業入力）" field="cadastral_map_sales_input" />
          <EditableButtonSelect label="地積測量図、字図" field="cadastral_map_field" options={['格納済み＆スプシに「有、無」を入力済み', '未', '不要']} />
        </>
      )}
      <EditableButtonSelect label="字図、地積測量図URL*" field="cadastral_map_url" options={['URL入力済み', '未']} />'''

# 変更後（タスク1のCadastralMapFieldSelectコンポーネント追加 + タスク2の条件分岐修正）
new_code = '''  // 地積測量図・字図ボタン選択コンポーネント（button-select-layout-rule.md に従った実装）
  const CADASTRAL_MAP_OPTIONS = ['格納済み＆スプシに「有、無」を入力済み', '未', '不要'];
  const CadastralMapFieldSelect = () => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
      <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap', flexShrink: 0, fontWeight: 500 }}>
        地積測量図、字図
      </Typography>
      <Box sx={{ display: 'flex', gap: 0.5, flex: 1 }}>
        {CADASTRAL_MAP_OPTIONS.map((opt) => (
          <Button
            key={opt}
            size="small"
            variant={getValue('cadastral_map_field') === opt ? 'contained' : 'outlined'}
            color="primary"
            onClick={() => handleFieldChange('cadastral_map_field', opt)}
            sx={{ flex: 1, py: 0.5, fontWeight: getValue('cadastral_map_field') === opt ? 'bold' : 'normal', borderRadius: 1 }}
          >
            {opt}
          </Button>
        ))}
      </Box>
    </Box>
  );

  // サイト登録セクション
  const SiteRegistrationSection = () => (
    <Box sx={{ p: 2 }}>
      <EditableField label="サイト登録締め日" field="site_registration_deadline" type="date" />
      <EditableField label="種別" field="property_type" />

      <SectionHeader label="【サイト登録依頼】" />
      <EditableField label="サイト備考" field="site_notes" />
      {getValue('property_type') === '土' && (
        <>
          <EditableField label="字図、地積測量図URL*" field="cadastral_map_url" type="url" />
          <EditableField label="地積測量図・字図（営業入力）" field="cadastral_map_sales_input" />
          <CadastralMapFieldSelect />
        </>
      )}'''

if old_code in text:
    text = text.replace(old_code, new_code)
    print('✅ タスク1 & タスク2: 変更を適用しました')
else:
    print('❌ 変更対象のコードが見つかりませんでした')
    # デバッグ用に一部を表示
    idx = text.find('// サイト登録セクション')
    if idx >= 0:
        print('--- 現在のコード（サイト登録セクション周辺）---')
        print(repr(text[idx:idx+500]))
    import sys
    sys.exit(1)

# UTF-8（BOMなし）で書き込む
with open('frontend/frontend/src/components/WorkTaskDetailModal.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ ファイルをUTF-8で保存しました')

# BOMチェック
with open('frontend/frontend/src/components/WorkTaskDetailModal.tsx', 'rb') as f:
    first_bytes = f.read(3)
if first_bytes == b'\xef\xbb\xbf':
    print('⚠️  BOM付きUTF-8です')
else:
    print('✅ BOMなしUTF-8です（正常）')
