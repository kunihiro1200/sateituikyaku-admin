#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""AssigneeSection.tsx を UTF-8 で作成するスクリプト"""

content = '''\
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Button,
  Typography,
  TextField,
  Snackbar,
  Alert,
} from '@mui/material';
import api from '../services/api';
import { Seller } from '../types';

// ============================================================
// 型定義
// ============================================================

interface AssigneeSectionProps {
  seller: Seller;
  onUpdate: (updatedFields: Partial<Seller>) => void;
}

interface AssigneeFieldConfig {
  label: string;
  sellerKey: keyof Seller;
  fieldType: 'assignee' | 'text';
}

// ============================================================
// フィールド定義
// ============================================================

const ASSIGNEE_FIELDS: AssigneeFieldConfig[] = [
  { label: '不通時Sメール担当',                      sellerKey: 'unreachableSmsAssignee',       fieldType: 'assignee' },
  { label: '査定Sメール担当',                        sellerKey: 'valuationSmsAssignee',         fieldType: 'assignee' },
  { label: '査定理由別３後Eメ担',                    sellerKey: 'valuationReasonEmailAssignee', fieldType: 'assignee' },
  { label: '査定理由（査定サイトから転記）',          sellerKey: 'valuationReason',              fieldType: 'text'     },
  { label: 'キャンセル案内担当',                     sellerKey: 'cancelNoticeAssignee',         fieldType: 'assignee' },
  { label: '除外前、長期客メール担当',                sellerKey: 'longTermEmailAssignee',        fieldType: 'assignee' },
  { label: '当社が電話したというリマインドメール担当', sellerKey: 'callReminderEmailAssignee',    fieldType: 'assignee' },
];

// ============================================================
// AssigneeSection コンポーネント
// ============================================================

export const AssigneeSection: React.FC<AssigneeSectionProps> = ({ seller, onUpdate }) => {
  // イニシャル一覧
  const [initials, setInitials] = useState<string[]>([]);

  // 各フィールドのローカル値（seller props から初期化）
  const [localValues, setLocalValues] = useState<Partial<Record<keyof Seller, string | null>>>(() => {
    const init: Partial<Record<keyof Seller, string | null>> = {};
    for (const field of ASSIGNEE_FIELDS) {
      init[field.sellerKey] = (seller[field.sellerKey] as string | null | undefined) ?? null;
    }
    return init;
  });

  // 査定理由テキスト（デバウンス用）
  const [valuationReasonText, setValuationReasonText] = useState<string>(
    (seller.valuationReason as string | undefined) ?? ''
  );

  // エラー Snackbar
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  // デバウンスタイマー
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ============================================================
  // イニシャル一覧の取得
  // ============================================================

  useEffect(() => {
    const fetchInitials = async () => {
      try {
        const response = await api.get<string[]>('/api/employees/active-initials');
        setInitials(response.data);
      } catch (err) {
        console.error('イニシャル取得エラー:', err);
        setInitials([]);
      }
    };
    fetchInitials();
  }, []);

  // ============================================================
  // seller props が変わったときにローカル値を同期
  // ============================================================

  useEffect(() => {
    const next: Partial<Record<keyof Seller, string | null>> = {};
    for (const field of ASSIGNEE_FIELDS) {
      next[field.sellerKey] = (seller[field.sellerKey] as string | null | undefined) ?? null;
    }
    setLocalValues(next);
    setValuationReasonText((seller.valuationReason as string | undefined) ?? '');
  }, [seller]);

  // ============================================================
  // 担当者フィールドの保存
  // ============================================================

  const saveField = useCallback(
    async (sellerKey: keyof Seller, value: string | null) => {
      // 楽観的更新前の値を保持
      const prevValue = localValues[sellerKey];

      // ローカル状態を先に更新
      setLocalValues((prev) => ({ ...prev, [sellerKey]: value }));

      try {
        await api.put(`/api/sellers/${seller.id}`, { [sellerKey]: value });
        onUpdate({ [sellerKey]: value } as Partial<Seller>);
      } catch (err) {
        console.error('保存エラー:', err);
        // 失敗時はローカル状態を元に戻す
        setLocalValues((prev) => ({ ...prev, [sellerKey]: prevValue }));
        setSnackbarMessage('保存に失敗しました。もう一度お試しください。');
        setSnackbarOpen(true);
      }
    },
    [seller.id, localValues, onUpdate]
  );

  // ============================================================
  // ボタンクリックハンドラ
  // ============================================================

  const handleButtonClick = useCallback(
    (sellerKey: keyof Seller, clickedValue: string) => {
      const current = localValues[sellerKey];
      // 同じボタンを再クリック → 選択解除（null）
      const newValue = current === clickedValue ? null : clickedValue;
      saveField(sellerKey, newValue);
    },
    [localValues, saveField]
  );

  // ============================================================
  // 査定理由テキストのデバウンス保存
  // ============================================================

  const handleValuationReasonChange = useCallback(
    (value: string) => {
      setValuationReasonText(value);
      setLocalValues((prev) => ({ ...prev, valuationReason: value }));

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(async () => {
        try {
          await api.put(`/api/sellers/${seller.id}`, { valuationReason: value });
          onUpdate({ valuationReason: value });
        } catch (err) {
          console.error('査定理由保存エラー:', err);
          setSnackbarMessage('査定理由の保存に失敗しました。');
          setSnackbarOpen(true);
        }
      }, 1000);
    },
    [seller.id, onUpdate]
  );

  // アンマウント時にタイマーをクリア
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // ============================================================
  // レンダリング
  // ============================================================

  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1, color: 'text.secondary' }}>
        担当者設定
      </Typography>

      {ASSIGNEE_FIELDS.map((field) => {
        const currentValue = localValues[field.sellerKey] as string | null;

        return (
          <Box
            key={String(field.sellerKey)}
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              mb: 0.75,
              gap: 1,
            }}
          >
            {/* ラベル */}
            <Typography
              variant="caption"
              sx={{
                minWidth: 160,
                flexShrink: 0,
                pt: field.fieldType === 'text' ? 1 : 0.5,
                color: 'text.secondary',
                fontSize: '0.7rem',
                lineHeight: 1.3,
              }}
            >
              {field.label}
            </Typography>

            {/* テキスト入力（査定理由） */}
            {field.fieldType === 'text' ? (
              <TextField
                size="small"
                multiline
                minRows={1}
                maxRows={4}
                value={valuationReasonText}
                onChange={(e) => handleValuationReasonChange(e.target.value)}
                sx={{ flex: 1, fontSize: '0.75rem' }}
                inputProps={{ style: { fontSize: '0.75rem' } }}
              />
            ) : (
              /* イニシャルボタン群 */
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {/* 不要ボタン */}
                <Button
                  size="small"
                  variant={currentValue === '不要' ? 'contained' : 'outlined'}
                  color={currentValue === '不要' ? 'error' : 'inherit'}
                  onClick={() => handleButtonClick(field.sellerKey, '不要')}
                  sx={{ minWidth: 'auto', px: 1, py: 0.25, fontSize: '0.7rem' }}
                >
                  不要
                </Button>

                {/* イニシャルボタン */}
                {initials.map((initial) => (
                  <Button
                    key={initial}
                    size="small"
                    variant={currentValue === initial ? 'contained' : 'outlined'}
                    color={currentValue === initial ? 'error' : 'inherit'}
                    onClick={() => handleButtonClick(field.sellerKey, initial)}
                    sx={{ minWidth: 'auto', px: 1, py: 0.25, fontSize: '0.7rem' }}
                  >
                    {initial}
                  </Button>
                ))}
              </Box>
            )}
          </Box>
        );
      })}

      {/* エラー Snackbar */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="error" onClose={() => setSnackbarOpen(false)}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default AssigneeSection;
'''

output_path = 'frontend/frontend/src/components/AssigneeSection.tsx'

with open(output_path, 'wb') as f:
    f.write(content.encode('utf-8'))

print(f'✅ {output_path} を UTF-8 で作成しました')

# BOM チェック
with open(output_path, 'rb') as f:
    head = f.read(3)
print(f'BOM check: {repr(head[:3])} (b"imp" などであれば OK)')
