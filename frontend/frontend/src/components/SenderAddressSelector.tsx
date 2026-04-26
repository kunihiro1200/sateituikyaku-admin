import React, { useEffect } from 'react';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
} from '@mui/material';

interface Employee {
  id: string;
  email: string;
  name: string;
  role: string;
  initials: string;
}

interface SenderAddressSelectorProps {
  value: string;
  onChange: (email: string) => void;
  employees: Employee[];
  disabled?: boolean;
  label?: string;
}

const SenderAddressSelector: React.FC<SenderAddressSelectorProps> = ({
  value,
  onChange,
  employees,
  disabled = false,
  label: labelProp,
}) => {
  const DEFAULT_VALUE = 'tenant@ifoo-oita.com';
  const label = labelProp || '返信先（Reply-To）';
  
  // テナント（共有）＋スタッフ全員をオプションとして表示
  const options = [
    { email: DEFAULT_VALUE, name: 'テナント（共有）', role: 'shared' },
    ...employees
      .filter(emp => emp.email && emp.email.trim() !== '')
      .map(emp => ({ email: emp.email, name: emp.name, role: emp.role })),
  ];

  // 値が空または未定義の場合はデフォルト値を使用し、親に通知
  useEffect(() => {
    if (!value || value.trim() === '') {
      onChange(DEFAULT_VALUE);
    }
  }, [value, onChange]);

  // 値が空または未定義の場合はデフォルト値を使用
  const effectiveValue = value && value.trim() !== '' ? value : DEFAULT_VALUE;

  // デバッグ用ログ
  console.log('SenderAddressSelector - value:', value, 'effectiveValue:', effectiveValue);

  return (
    <FormControl fullWidth size="small" sx={{ mb: 2 }}>
      <InputLabel shrink={true}>{label}</InputLabel>
      <Select
        value={effectiveValue}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        label={label}
        displayEmpty={true}
        notched={true}
      >
        {options.map((option) => (
          <MenuItem key={option.email} value={option.email}>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {option.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {option.email}
              </Typography>
            </Box>
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};

export default SenderAddressSelector;
