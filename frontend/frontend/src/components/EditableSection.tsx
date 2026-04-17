import React, { useState } from 'react';
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
      onEditToggle(); // 成功時のみ編集モードを終了
    } catch (error) {
      if (error instanceof Error && error.message === 'no_changes') {
        // 変更なし: 編集モードを維持（ログ出力なし）
      } else {
        console.error('Save failed:', error);
        // 編集モードは維持される（onEditToggle を呼ばない）
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Paper sx={{ p: 1, mb: 1, maxWidth }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.25 }}>
        <Typography variant="subtitle2" sx={{ fontSize: '0.75rem', fontWeight: 'bold' }}>{title}</Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          {!isEditMode ? (
            <IconButton onClick={onEditToggle} size="small" title="編集">
              <EditIcon sx={{ fontSize: '1rem' }} />
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
                  fontSize: '0.75rem',
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
                size="small"
                disabled={isSaving}
                title="キャンセル"
              >
                <CancelIcon sx={{ fontSize: '1rem' }} />
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
