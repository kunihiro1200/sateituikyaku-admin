new_content = """import { useState, useEffect, useRef, useCallback } from 'react';
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
  { label: '\u4e0d\u901a\u6642S\u30e1\u30fc\u30eb\u62c5\u5f53',                      sellerKey: 'unreachableSmsAssignee',       fieldType: 'assignee' },
  { label: '\u67fb\u5b9aS\u30e1\u30fc\u30eb\u62c5\u5f53',                        sellerKey: 'valuationSmsAssignee',         fieldType: 'assignee' },
  { label: '\u67fb\u5b9a\u7406\u7531\u52253\u5f8cE\u30e1\u62c5',                    sellerKey: 'valuationReasonEmailAssignee', fieldType: 'assignee' },
  { label: '\u67fb\u5b9a\u7406\u7531\uff08\u67fb\u5b9a\u30b5\u30a4\u30c8\u304b\u3089\u8ee2\u8a18\uff09',          sellerKey: 'valuationReason',              fieldType: 'text'     },
  { label: '\u30ad\u30e3\u30f3\u30bb\u30eb\u6848\u5185\u62c5\u5f53',                     sellerKey: 'cancelNoticeAssignee',         fieldType: 'assignee' },
  { label: '\u9664\u5916\u524d\u3001\u9577\u671f\u5ba2\u30e1\u30fc\u30eb\u62c5\u5f53',                sellerKey: 'longTermEmailAssignee',        fieldType: 'assignee' },
  { label: '\u5f53\u793e\u304c\u96fb\u8a71\u3057\u305f\u3068\u3044\u3046\u30ea\u30de\u30a4\u30f3\u30c9\u30e1\u30fc\u30eb\u62c5\u5f53', sellerKey: 'callReminderEmailAssignee',    fieldType: 'assignee' },
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
        console.error('\u30a4\u30cb\u30b7\u30e3\u30eb\u53d6\u5f97\u30a8\u30e9\u30fc:', err);
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
        console.error('\u4fdd\u5b58\u30a8\u30e9\u30fc:', err);
        setLocalValues((prev) => ({ ...prev, [sellerKey]: prevValue }));
        setSnackbarMessage('\u4fdd\u5b58\u306b\u5931\u6557\u3057\u307e\u3057\u305f\u3002\u3082\u3046\u4e00\u5ea6\u304a\u8a66\u3057\u304f\u3060\u3055\u3044\u3002');
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
          console.error('\u67fb\u5b9a\u7406\u7531\u4fdd\u5b58\u30a8\u30e9\u30fc:', err);
          setSnackbarMessage('\u67fb\u5b9a\u7406\u7531\u306e\u4fdd\u5b58\u306b\u5931\u6557\u3057\u307e\u3057\u305f\u3002');
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
        \u62c5\u5f53\u8005\u8a2d\u5b9a
      </Typography>

      {ASSIGNEE_FIELDS.map((field) => {
        const currentValue = localValues[field.sellerKey] as string | null;

        return (
          <Box key={String(field.sellerKey)} sx={{ mb: 2 }}>
            {/* \u30e9\u30d9\u30eb\uff08\u4e0a\u306b\u5927\u304d\u304f\u8868\u793a\uff09 */}
            <Typography variant="body1" sx={{ mb: 0.75, fontWeight: 500 }}>
              {field.label}
            </Typography>

            {/* \u30c6\u30ad\u30b9\u30c8\u5165\u529b\uff08\u67fb\u5b9a\u7406\u7531\uff09 */}
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
              /* \u30dc\u30bf\u30f3\u7fa4\uff1a\u5168\u5e45\u3067\u6298\u308a\u8fd4\u3057\u3001\u5404\u30dc\u30bf\u30f3\u306f\u540c\u3058\u5e45\u3067\u4e26\u3076 */
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
                  variant={currentValue === '\u4e0d\u8981' ? 'contained' : 'outlined'}
                  color={currentValue === '\u4e0d\u8981' ? 'error' : 'inherit'}
                  onClick={() => handleButtonClick(field.sellerKey, '\u4e0d\u8981')}
                  sx={{
                    py: 0.75,
                    fontSize: '0.85rem',
                    bgcolor: currentValue === '\u4e0d\u8981' ? undefined : 'grey.100',
                    borderColor: 'grey.300',
                  }}
                >
                  \u4e0d\u8981
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
"""

with open('frontend/frontend/src/components/AssigneeSection.tsx', 'wb') as f:
    f.write(new_content.encode('utf-8'))

print('完了')
