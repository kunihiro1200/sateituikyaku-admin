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

interface AssigneeSectionProps {
  seller: Seller;
  onUpdate: (updatedFields: Partial<Seller>) => void;
}

interface AssigneeFieldConfig {
  label: string;
  sellerKey: keyof Seller;
  fieldType: 'assignee' | 'text';
}

const ASSIGNEE_FIELDS: AssigneeFieldConfig[] = [
  { label: '不通時Sメール担当',                      sellerKey: 'unreachableSmsAssignee',       fieldType: 'assignee' },
  { label: '査定Sメール担当',                        sellerKey: 'valuationSmsAssignee',         fieldType: 'assignee' },
  { label: '査定理由別3後Eメ担',                    sellerKey: 'valuationReasonEmailAssignee', fieldType: 'assignee' },
  { label: '査定理由（査定サイトから転記）',          sellerKey: 'valuationReason',              fieldType: 'text'     },
  { label: 'キャンセル案内担当',                     sellerKey: 'cancelNoticeAssignee',         fieldType: 'assignee' },
  { label: '除外前、長期客メール担当',                sellerKey: 'longTermEmailAssignee',        fieldType: 'assignee' },
  { label: '当社が電話したというリマインドメール担当', sellerKey: 'callReminderEmailAssignee',    fieldType: 'assignee' },
];

export const AssigneeSection: React.FC<AssigneeSectionProps> = ({ seller, onUpdate }) => {
  const [initials, setInitials] = useState<string[]>([]);

  const [localValues, setLocalValues] = useState<Partial<Record<keyof Seller, string | null>>>(() => {
    const init: Partial<Record<keyof Seller, string | null>> = {};
    for (const field of ASSIGNEE_FIELDS) {
      init[field.sellerKey] = (seller[field.sellerKey] as string | null | undefined) ?? null;
    }
    return init;
  });

  const [valuationReasonText, setValuationReasonText] = useState<string>(
    (seller.valuationReason as string | undefined) ?? ''
  );

  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const fetchInitials = async () => {
      try {
        const response = await api.get('/api/employees/active-initials');
        const data = response.data;
        const initialsArray = Array.isArray(data)
          ? data
          : Array.isArray(data?.initials)
          ? data.initials
          : [];
        setInitials(initialsArray);
      } catch (err) {
        console.error('イニシャル取得エラー:', err);
        setInitials([]);
      }
    };
    fetchInitials();
  }, []);

  useEffect(() => {
    const next: Partial<Record<keyof Seller, string | null>> = {};
    for (const field of ASSIGNEE_FIELDS) {
      next[field.sellerKey] = (seller[field.sellerKey] as string | null | undefined) ?? null;
    }
    setLocalValues(next);
    setValuationReasonText((seller.valuationReason as string | undefined) ?? '');
  }, [seller]);

  const saveField = useCallback(
    async (sellerKey: keyof Seller, value: string | null) => {
      const prevValue = localValues[sellerKey];
      setLocalValues((prev) => ({ ...prev, [sellerKey]: value }));
      try {
        await api.put(`/api/sellers/${seller.id}`, { [sellerKey]: value });
        onUpdate({ [sellerKey]: value } as Partial<Seller>);
      } catch (err) {
        console.error('保存エラー:', err);
        setLocalValues((prev) => ({ ...prev, [sellerKey]: prevValue }));
        setSnackbarMessage('保存に失敗しました。もう一度お試しください。');
        setSnackbarOpen(true);
      }
    },
    [seller.id, localValues, onUpdate]
  );

  const handleButtonClick = useCallback(
    (sellerKey: keyof Seller, clickedValue: string) => {
      const current = localValues[sellerKey];
      const newValue = current === clickedValue ? null : clickedValue;
      saveField(sellerKey, newValue);
    },
    [localValues, saveField]
  );

  const handleValuationReasonChange = useCallback(
    (value: string) => {
      setValuationReasonText(value);
      setLocalValues((prev) => ({ ...prev, valuationReason: value }));
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
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

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
        担当者設定
      </Typography>

      {ASSIGNEE_FIELDS.map((field) => {
        const currentValue = localValues[field.sellerKey] as string | null;

        return (
          <Box key={String(field.sellerKey)} sx={{ mb: 2 }}>
            {/* ラベル（上に大きく表示） */}
            <Typography variant="body1" sx={{ mb: 0.75, fontWeight: 500 }}>
              {field.label}
            </Typography>

            {/* テキスト入力（査定理由） */}
            {field.fieldType === 'text' ? (
              <TextField
                size="small"
                multiline
                minRows={1}
                maxRows={4}
                fullWidth
                value={valuationReasonText}
                onChange={(e) => handleValuationReasonChange(e.target.value)}
              />
            ) : (
              /* ボタン群：全幅で折り返し、各ボタンは同じ幅で並ぶ */
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(52px, 1fr))',
                  gap: 0.5,
                }}
              >
                {initials.map((initial) => (
                  <Button
                    key={initial}
                    size="small"
                    variant={currentValue === initial ? 'contained' : 'outlined'}
                    color={currentValue === initial ? 'primary' : 'inherit'}
                    onClick={() => handleButtonClick(field.sellerKey, initial)}
                    sx={{
                      py: 0.75,
                      fontSize: '0.85rem',
                      bgcolor: currentValue === initial ? undefined : 'grey.100',
                      borderColor: 'grey.300',
                    }}
                  >
                    {initial}
                  </Button>
                ))}
                <Button
                  size="small"
                  variant={currentValue === '不要' ? 'contained' : 'outlined'}
                  color={currentValue === '不要' ? 'error' : 'inherit'}
                  onClick={() => handleButtonClick(field.sellerKey, '不要')}
                  sx={{
                    py: 0.75,
                    fontSize: '0.85rem',
                    bgcolor: currentValue === '不要' ? undefined : 'grey.100',
                    borderColor: 'grey.300',
                  }}
                >
                  不要
                </Button>
              </Box>
            )}
          </Box>
        );
      })}

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
