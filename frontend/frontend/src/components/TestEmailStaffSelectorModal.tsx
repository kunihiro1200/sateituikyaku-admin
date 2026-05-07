import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Checkbox,
  Divider,
  Alert,
  TextField,
  InputAdornment,
} from '@mui/material';
import {
  Search as SearchIcon,
  Person as PersonIcon,
} from '@mui/icons-material';

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  initials: string;
}

interface TestEmailStaffSelectorModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (selectedStaff: StaffMember[]) => void;
  employees: StaffMember[];
}

export default function TestEmailStaffSelectorModal({
  open,
  onClose,
  onConfirm,
  employees,
}: TestEmailStaffSelectorModalProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searchText, setSearchText] = useState('');

  // メールアドレスがあるスタッフのみ表示
  const filteredEmployees = employees.filter(
    (emp) =>
      emp.email &&
      (emp.name.includes(searchText) ||
        emp.email.includes(searchText) ||
        emp.initials.includes(searchText))
  );

  const handleToggle = (email: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(email)) {
        next.delete(email);
      } else {
        next.add(email);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelected(new Set(filteredEmployees.map((e) => e.email)));
  };

  const handleDeselectAll = () => {
    setSelected(new Set());
  };

  const handleConfirm = () => {
    const selectedStaff = employees.filter((e) => selected.has(e.email));
    onConfirm(selectedStaff);
    setSelected(new Set());
    setSearchText('');
  };

  const handleClose = () => {
    setSelected(new Set());
    setSearchText('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PersonIcon color="primary" />
          <Typography variant="h6">テスト送信先スタッフを選択</Typography>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        <Alert severity="info" sx={{ mb: 2 }}>
          選択したスタッフに、実際の配信メールと同じ内容でテスト送信します。
        </Alert>

        {/* 検索フィールド */}
        <TextField
          fullWidth
          size="small"
          placeholder="名前・メールアドレスで検索"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          sx={{ mb: 1 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />

        {/* 全選択・全解除 */}
        <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
          <Button size="small" variant="outlined" onClick={handleSelectAll}>
            全て選択
          </Button>
          <Button size="small" variant="outlined" onClick={handleDeselectAll}>
            全て外す
          </Button>
          <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto', alignSelf: 'center' }}>
            {selected.size}名選択中
          </Typography>
        </Box>

        <Divider sx={{ mb: 1 }} />

        {filteredEmployees.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
            {employees.length === 0
              ? 'スタッフ情報を読み込み中...'
              : '該当するスタッフが見つかりません'}
          </Typography>
        ) : (
          <List dense sx={{ maxHeight: 360, overflow: 'auto' }}>
            {filteredEmployees.map((emp) => (
              <ListItem
                key={emp.email}
                button
                onClick={() => handleToggle(emp.email)}
                sx={{
                  borderRadius: 1,
                  mb: 0.5,
                  bgcolor: selected.has(emp.email) ? 'primary.50' : 'transparent',
                  '&:hover': { bgcolor: 'action.hover' },
                }}
              >
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <Checkbox
                    edge="start"
                    checked={selected.has(emp.email)}
                    tabIndex={-1}
                    disableRipple
                    size="small"
                  />
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Typography variant="body2" fontWeight={selected.has(emp.email) ? 'bold' : 'normal'}>
                      {emp.name}
                      {emp.initials && emp.initials !== emp.name && (
                        <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
                          ({emp.initials})
                        </Typography>
                      )}
                    </Typography>
                  }
                  secondary={
                    <Typography variant="caption" color="text.secondary">
                      {emp.email}
                    </Typography>
                  }
                />
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={handleClose} color="inherit">
          キャンセル
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          disabled={selected.size === 0}
          color="warning"
        >
          テスト送信へ進む ({selected.size}名)
        </Button>
      </DialogActions>
    </Dialog>
  );
}
