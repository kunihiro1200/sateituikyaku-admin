#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
1. EditableSection.tsx: 保存ボタンを「保存」テキスト付きに変更、hasChangesで光るアニメーション
2. PriceSection.tsx: 「値下げ履歴が見つかりません」赤字テキストを削除
3. PropertyListingDetailPage.tsx: 価格情報EditableSectionにhasChanges追加
"""

# ===== 1. EditableSection.tsx =====
new_editable_section = '''import React, { useState } from 'react';
import { Box, Button, CircularProgress, IconButton, Paper, Typography } from '@mui/material';
import { Edit as EditIcon, Save as SaveIcon, Cancel as CancelIcon } from '@mui/icons-material';

interface EditableSectionProps {
  title: string;
  isEditMode: boolean;
  onEditToggle: () => void;
  onSave: () => Promise<void>;
  onCancel: () => void;
  children: React.ReactNode;
  maxWidth?: string;
  hasChanges?: boolean;
}

/**
 * EditableSection - セクション単位で編集可能なコンポーネント
 *
 * 読み取り専用モードと編集モードを切り替え可能。
 * 編集モード時は保存・キャンセルボタンを表示。
 * hasChanges=true の場合、保存ボタンが光って押すよう促す。
 */
const EditableSection: React.FC<EditableSectionProps> = ({
  title,
  isEditMode,
  onEditToggle,
  onSave,
  onCancel,
  children,
  maxWidth,
  hasChanges = false,
}) => {
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave();
      onEditToggle();
    } catch (error) {
      console.error('Save failed:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Paper sx={{ p: 2, mb: 2, maxWidth }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
        <Typography variant="h6" sx={{ fontSize: '1.25rem', fontWeight: 'bold' }}>{title}</Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          {!isEditMode ? (
            <IconButton onClick={onEditToggle} size="medium" title="編集">
              <EditIcon sx={{ fontSize: '1.5rem' }} />
            </IconButton>
          ) : (
            <>
              <Button
                variant="contained"
                size="small"
                onClick={handleSave}
                disabled={isSaving}
                startIcon={isSaving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
                sx={{
                  fontWeight: 'bold',
                  fontSize: '0.9rem',
                  px: 2,
                  ...(hasChanges && !isSaving ? {
                    backgroundColor: '#d32f2f',
                    '&:hover': { backgroundColor: '#b71c1c' },
                    animation: 'pulseSave 1.5s infinite',
                    '@keyframes pulseSave': {
                      '0%': { boxShadow: '0 0 0 0 rgba(211, 47, 47, 0.7)' },
                      '70%': { boxShadow: '0 0 0 8px rgba(211, 47, 47, 0)' },
                      '100%': { boxShadow: '0 0 0 0 rgba(211, 47, 47, 0)' },
                    },
                  } : {}),
                }}
              >
                {isSaving ? '保存中...' : '保存'}
              </Button>
              <IconButton
                onClick={onCancel}
                size="medium"
                disabled={isSaving}
                title="キャンセル"
              >
                <CancelIcon sx={{ fontSize: '1.5rem' }} />
              </IconButton>
            </>
          )}
        </Box>
      </Box>
      {children}
    </Paper>
  );
};

export default EditableSection;
'''

with open('frontend/frontend/src/components/EditableSection.tsx', 'wb') as f:
    f.write(new_editable_section.encode('utf-8'))
print('EditableSection.tsx: 更新完了')

# ===== 2. PriceSection.tsx: 「値下げ履歴が見つかりません」赤字テキストを削除 =====
with open('frontend/frontend/src/components/PriceSection.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

old_error_text = """            {!getLatestPriceReduction() && (
              <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
                値下げ履歴が見つかりません
              </Typography>
            )}"""

if old_error_text in text:
    text = text.replace(old_error_text, '')
    print('PriceSection.tsx: 赤字テキスト削除成功')
else:
    print('PriceSection.tsx: 対象文字列が見つかりません')

with open('frontend/frontend/src/components/PriceSection.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

# ===== 3. PropertyListingDetailPage.tsx: 価格情報EditableSectionにhasChanges追加 =====
with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'rb') as f:
    content2 = f.read()

text2 = content2.decode('utf-8')

old_editable = """              <EditableSection
                title="価格情報"
                isEditMode={isPriceEditMode}
                onEditToggle={() => setIsPriceEditMode(!isPriceEditMode)}
                onSave={handleSavePrice}
                onCancel={handleCancelPrice}
              >"""

new_editable = """              <EditableSection
                title="価格情報"
                isEditMode={isPriceEditMode}
                onEditToggle={() => setIsPriceEditMode(!isPriceEditMode)}
                onSave={handleSavePrice}
                onCancel={handleCancelPrice}
                hasChanges={Object.keys(editedData).length > 0}
              >"""

if old_editable in text2:
    text2 = text2.replace(old_editable, new_editable)
    print('PropertyListingDetailPage.tsx: hasChanges追加成功')
else:
    print('PropertyListingDetailPage.tsx: 対象文字列が見つかりません')

with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'wb') as f:
    f.write(text2.encode('utf-8'))

print('全て完了')
