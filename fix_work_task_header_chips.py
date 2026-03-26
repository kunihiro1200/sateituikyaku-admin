# WorkTaskDetailModal.tsx に物件情報 Chip を追加するスクリプト
with open('frontend/frontend/src/components/WorkTaskDetailModal.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 1. Chip を @mui/material のインポートに追加
old_import = """import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Box,
  Tabs,
  Tab,
  Typography,
  TextField,
  Button,
  ButtonGroup,
  Grid,
  CircularProgress,
  Link,
  Snackbar,
  Alert,
} from '@mui/material';"""

new_import = """import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Box,
  Tabs,
  Tab,
  Typography,
  TextField,
  Button,
  ButtonGroup,
  Grid,
  CircularProgress,
  Link,
  Snackbar,
  Alert,
  Chip,
} from '@mui/material';"""

text = text.replace(old_import, new_import)

# 2. DialogTitle の構造を変更
old_dialog_title = """          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Button
              variant="contained"
              size="small"
              onClick={onClose}
              sx={{ bgcolor: '#8e24aa', '&:hover': { bgcolor: '#6a1b9a' }, fontWeight: 700, whiteSpace: 'nowrap' }}
            >
              業務一覧
            </Button>
            <Typography variant="h6">業務詳細 -</Typography>
            <Box
              onClick={() => { navigator.clipboard.writeText(propertyNumber || ''); }}
              sx={{
                cursor: 'pointer',
                px: 1.5, py: 0.5,
                bgcolor: '#f5f5f5',
                border: '1px solid #ddd',
                borderRadius: 1,
                fontWeight: 700,
                fontSize: '1.1rem',
                userSelect: 'all',
                '&:hover': { bgcolor: '#e3f2fd', borderColor: '#1565c0' },
                '&:active': { bgcolor: '#bbdefb' },
              }}
              title="クリックでコピー"
            >
              {propertyNumber || ''}
            </Box>
          </Box>"""

new_dialog_title = """          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, overflow: 'hidden' }}>
            <Button
              variant="contained"
              size="small"
              onClick={onClose}
              sx={{ bgcolor: '#8e24aa', '&:hover': { bgcolor: '#6a1b9a' }, fontWeight: 700, whiteSpace: 'nowrap' }}
            >
              業務一覧
            </Button>
            <Typography variant="h6">業務詳細 -</Typography>
            <Box
              onClick={() => { navigator.clipboard.writeText(propertyNumber || ''); }}
              sx={{
                cursor: 'pointer',
                px: 1.5, py: 0.5,
                bgcolor: '#f5f5f5',
                border: '1px solid #ddd',
                borderRadius: 1,
                fontWeight: 700,
                fontSize: '1.1rem',
                userSelect: 'all',
                whiteSpace: 'nowrap',
                '&:hover': { bgcolor: '#e3f2fd', borderColor: '#1565c0' },
                '&:active': { bgcolor: '#bbdefb' },
              }}
              title="クリックでコピー"
            >
              {propertyNumber || ''}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, overflowX: 'auto', flexShrink: 1, flexWrap: 'nowrap' }}>
              {data?.property_address && <Chip label={data.property_address} size="small" variant="outlined" sx={{ fontSize: '0.75rem' }} />}
              {data?.property_type && <Chip label={data.property_type} size="small" variant="outlined" sx={{ fontSize: '0.75rem' }} />}
              {data?.seller_name && <Chip label={data.seller_name} size="small" variant="outlined" sx={{ fontSize: '0.75rem' }} />}
              {data?.sales_assignee && <Chip label={data.sales_assignee} size="small" variant="outlined" sx={{ fontSize: '0.75rem' }} />}
              {data?.mediation_type && <Chip label={data.mediation_type} size="small" variant="outlined" sx={{ fontSize: '0.75rem' }} />}
            </Box>
          </Box>"""

text = text.replace(old_dialog_title, new_dialog_title)

# UTF-8で書き込む（BOMなし）
with open('frontend/frontend/src/components/WorkTaskDetailModal.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
