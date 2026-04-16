import React from 'react';
import { Autocomplete, TextField, Typography, Box } from '@mui/material';

interface LatestStatusDropdownProps {
  value: string | null;
  isEditing: boolean;
  onChange: (value: string) => void;
  options?: string[];
}

const DEFAULT_OPTIONS = [
  'A:この物件を気に入っている（こちらからの一押しが必要）',
  'B:内覧した物件はNGだが（内覧後の場合）、購入期限が決まっている方（賃貸の更新や進学転勤等で1年以内になど）',
  'C:希望の物件があれば時期関係なくすぐに購入したい方',
  'D:配信・追客不要案件（業者や確度が低く追客不要案件等）',
  'E:希望の物件があれば購入したいが、数年後など、配信のみで追客する方',
  '不明（聞き取れず）',
  'AZ:Aだが次電日不要',
  'BZ：Bだが次電日不要',
  '買（専任 両手）',
  '買（専任 片手）',
  '買（一般 両手）',
  '買（一般 片手）',
  '他決',
  '2番手',
  '3番手',
  '買付外れました',
];

const LatestStatusDropdown: React.FC<LatestStatusDropdownProps> = ({
  value,
  isEditing,
  onChange,
  options = DEFAULT_OPTIONS,
}) => {
  if (isEditing) {
    return (
      <Autocomplete
        freeSolo
        options={options}
        value={value || ''}
        onChange={(_, newValue) => {
          onChange(newValue || '');
        }}
        onInputChange={(_, newInputValue) => {
          onChange(newInputValue);
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            label="最新状況"
            placeholder="状況を選択または入力"
            variant="outlined"
            fullWidth
          />
        )}
      />
    );
  }

  return (
    <Box>
      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
        最新状況
      </Typography>
      <Typography variant="body2">
        {value || '（未設定）'}
      </Typography>
    </Box>
  );
};

export default LatestStatusDropdown;
