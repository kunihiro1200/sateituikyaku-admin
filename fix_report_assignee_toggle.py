# PropertyReportPage.tsx の報告担当をドロップダウンからToggleButtonGroupに変更

with open('frontend/frontend/src/pages/PropertyReportPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 1. import から FormControl, InputLabel, Select, MenuItem を削除し、ToggleButtonGroup/ToggleButton はすでにある
old_imports = """import {
  Container,
  Box,
  Typography,
  Paper,
  Button,
  CircularProgress,
  IconButton,
  Snackbar,
  Alert,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';"""

new_imports = """import {
  Container,
  Box,
  Typography,
  Paper,
  Button,
  CircularProgress,
  IconButton,
  Snackbar,
  Alert,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';"""

text = text.replace(old_imports, new_imports)

# 2. 報告担当セクションをToggleButtonGroupに変更
old_assignee = """        {/* 報告担当 */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="body2" color="text.secondary" fontWeight="bold" sx={{ mb: 1 }}>
            報告担当
          </Typography>
          <FormControl fullWidth size="small">
            <Select
              value={reportData.report_assignee || ''}
              onChange={(e) => setReportData((prev) => ({ ...prev, report_assignee: e.target.value }))}
              displayEmpty
            >
              <MenuItem value="">
                <em>未選択</em>
              </MenuItem>
              {jimuInitials.map((initial) => (
                <MenuItem key={initial} value={initial}>
                  {initial}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {reportData.sales_assignee && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              物件担当: {reportData.sales_assignee}
            </Typography>
          )}
        </Box>"""

new_assignee = """        {/* 報告担当 */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="body2" color="text.secondary" fontWeight="bold" sx={{ mb: 1 }}>
            報告担当
          </Typography>
          <ToggleButtonGroup
            value={reportData.report_assignee || ''}
            exclusive
            onChange={(_, value) => {
              setReportData((prev) => ({ ...prev, report_assignee: value || '' }));
            }}
            size="small"
            sx={{ flexWrap: 'wrap', gap: 0.5 }}
          >
            {jimuInitials.map((initial) => (
              <ToggleButton
                key={initial}
                value={initial}
                sx={{
                  px: 2,
                  minWidth: 48,
                  fontWeight: 'bold',
                  '&.Mui-selected': {
                    backgroundColor: 'primary.main',
                    color: 'white',
                    '&:hover': { backgroundColor: 'primary.dark' },
                  },
                }}
              >
                {initial}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          {reportData.sales_assignee && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              物件担当: {reportData.sales_assignee}
            </Typography>
          )}
        </Box>"""

text = text.replace(old_assignee, new_assignee)

with open('frontend/frontend/src/pages/PropertyReportPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
print('Changed:', old_assignee in content.decode('utf-8'))
