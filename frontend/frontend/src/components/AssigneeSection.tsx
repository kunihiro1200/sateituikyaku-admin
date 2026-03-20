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

// SMSテンプレートID → 対応するsellerKeyのマッピング
export const SMS_TEMPLATE_ASSIGNEE_MAP: Partial<Record<string, keyof Seller>> = {
  initial_cancellation: 'unreachableSmsAssignee',
  cancellation:         'cancelNoticeAssignee',
  valuation:            'valuationSmsAssignee',
  long_term_customer:   'longTermEmailAssignee',
  call_reminder:        'callReminderEmailAssignee',
  visit_reminder:       'visitReminderAssignee',
};

// EmailテンプレートID → 対応するsellerKeyのマッピング
export const EMAIL_TEMPLATE_ASSIGNEE_MAP: Partial<Record<string, keyof Seller>> = {
  ieul_call_cancel:            'cancelNoticeAssignee',
  ieul_cancel_only:            'cancelNoticeAssignee',
  lifull_yahoo_call_cancel:    'cancelNoticeAssignee',
  lifull_yahoo_cancel_only:    'cancelNoticeAssignee',
  sumai_step_call_cancel:      'cancelNoticeAssignee',
  sumai_step_cancel_only:      'cancelNoticeAssignee',
  home4u_call_cancel:          'cancelNoticeAssignee',
  reason_relocation_3day:      'valuationReasonEmailAssignee',
  reason_inheritance_3day:     'valuationReasonEmailAssignee',
  reason_divorce_3day:         'valuationReasonEmailAssignee',
  reason_loan_3day:            'valuationReasonEmailAssignee',
  exclusion_long_term:         'longTermEmailAssignee',
  remind:                      'callReminderEmailAssignee',
  visit_reminder:              'visitReminderAssignee',
};

// 活動履歴のラベル → sellerKey（SMS）
const SMS_LABEL_TO_KEY: Record<string, keyof Seller> = {
  '不通時Sメール':                       'unreachableSmsAssignee',
  'キャンセル案内':                       'cancelNoticeAssignee',
  '査定Sメール':                         'valuationSmsAssignee',
  '除外前・長期客Sメール':               'longTermEmailAssignee',
  '当社が電話したというリマインドメール': 'callReminderEmailAssignee',
  '訪問事前通知メール':                   'visitReminderAssignee',
};

// 活動履歴のラベル → sellerKey（Email）
const EMAIL_LABEL_TO_KEY: Record<string, keyof Seller> = {
  '不通で電話時間確認＆キャンセル案内（イエウール）':     'cancelNoticeAssignee',
  'キャンセル案内のみ（イエウール）':                     'cancelNoticeAssignee',
  '不通で電話時間確認＆キャンセル案内（LIFULLとYahoo）': 'cancelNoticeAssignee',
  'キャンセル案内のみ（LIFULLとYahoo）':                 'cancelNoticeAssignee',
  '不通で電話時間確認＆キャンセル案内（すまいステップ）': 'cancelNoticeAssignee',
  'キャンセル案内のみ（すまいステップ）':                 'cancelNoticeAssignee',
  '不通で電話時間確認＆キャンセル案内（HOME4U）':         'cancelNoticeAssignee',
  '（査定理由別）住替え先（３日後メール）':               'valuationReasonEmailAssignee',
  '（査定理由別）相続（３日後メール）':                   'valuationReasonEmailAssignee',
  '（査定理由別）離婚（３日後メール）':                   'valuationReasonEmailAssignee',
  '（査定理由別）ローン厳しい（３日後メール）':           'valuationReasonEmailAssignee',
  '除外前、長期客（お客様いるメール）':                   'longTermEmailAssignee',
  'リマインド':                                           'callReminderEmailAssignee',
  '☆訪問前日通知メール':                                 'visitReminderAssignee',
};

// 活動履歴からsellerKeyごとの送信状態を計算
export function calcSendStatus(
  activities: { type: string; content: string }[]
): Partial<Record<keyof Seller, 'sms' | 'email' | 'both'>> {
  const smsSent = new Set<keyof Seller>();
  const emailSent = new Set<keyof Seller>();

  for (const act of activities) {
    const match = act.content?.match(/^【(.+?)】/);
    if (!match) continue;
    const label = match[1];
    if (act.type === 'sms') {
      const key = SMS_LABEL_TO_KEY[label];
      if (key) smsSent.add(key);
    } else if (act.type === 'email') {
      const key = EMAIL_LABEL_TO_KEY[label];
      if (key) emailSent.add(key);
    }
  }

  const result: Partial<Record<keyof Seller, 'sms' | 'email' | 'both'>> = {};
  const allKeys = new Set([...smsSent, ...emailSent]);
  for (const key of allKeys) {
    const hasSms = smsSent.has(key);
    const hasEmail = emailSent.has(key);
    if (hasSms && hasEmail) result[key] = 'both';
    else if (hasSms) result[key] = 'sms';
    else result[key] = 'email';
  }
  return result;
}

interface AssigneeSectionProps {
  seller: Seller;
  onUpdate: (updatedFields: Partial<Seller>) => void;
  /** 活動履歴（SMS/Email送信状態の色付けに使用） */
  activities?: { type: string; content: string }[];
  /** SMS送信後に呼び出す: templateId と送信者イニシャルを渡す */
  onSmsTemplateUsed?: (templateId: string, initial: string) => void;
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
  { label: '訪問事前通知メール担当',                  sellerKey: 'visitReminderAssignee',        fieldType: 'assignee' },
];

export const AssigneeSection: React.FC<AssigneeSectionProps> = ({ seller, onUpdate, activities = [], onSmsTemplateUsed }) => {
  const [initials, setInitials] = useState<string[]>([]);

  // 活動履歴からSMS/Email送信状態を計算
  const sendStatus = calcSendStatus(activities);

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
    <Box sx={{ mb: 2, bgcolor: '#f0f4ff', borderRadius: 2, p: 2, border: '1px solid #c5cae9' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
        <Typography variant="h6" sx={{ fontWeight: 'bold', fontSize: '1.05rem' }}>
          メール送信確認
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, ml: 1 }}>
          <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#f44336', flexShrink: 0 }} />
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>SMS</Typography>
          <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#1976d2', flexShrink: 0, ml: 0.5 }} />
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>Email</Typography>
          <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#ff9800', flexShrink: 0, ml: 0.5 }} />
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>両方</Typography>
        </Box>
      </Box>

      {ASSIGNEE_FIELDS.map((field) => {
        const currentValue = localValues[field.sellerKey] as string | null;
        const status = sendStatus[field.sellerKey];

        return (
          <Box key={String(field.sellerKey)} sx={{ mb: 2 }}>
            <Typography variant="body1" sx={{ mb: 0.75, fontWeight: 500 }}>
              {field.label}
            </Typography>

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
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, width: '100%' }}>
                {initials.map((initial) => {
                  const isSelected = currentValue === initial;
                  // 選択中ボタンの色: SMS→赤、Email→青、両方→オレンジ
                  let bgColor: string | undefined;
                  if (isSelected && status === 'sms')   bgColor = '#f44336';
                  if (isSelected && status === 'email') bgColor = '#1976d2';
                  if (isSelected && status === 'both')  bgColor = '#ff9800';

                  return (
                    <Button
                      key={initial}
                      size="small"
                      variant={isSelected ? 'contained' : 'outlined'}
                      onClick={() => handleButtonClick(field.sellerKey, initial)}
                      sx={{
                        py: 0.75,
                        fontSize: '0.85rem',
                        bgcolor: isSelected ? (bgColor ?? undefined) : 'grey.100',
                        borderColor: 'grey.300',
                        color: isSelected && bgColor ? '#fff' : undefined,
                        '&:hover': isSelected && bgColor ? { bgcolor: bgColor, opacity: 0.85 } : {},
                      }}
                    >
                      {initial}
                    </Button>
                  );
                })}
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
