# -*- coding: utf-8 -*-
"""
1. Dialog, FormControl, Select, MenuItem のimportを追加
2. salesContractDialog の重複定義を削除
"""

filepath = 'frontend/frontend/src/pages/PropertyListingDetailPage.tsx'

with open(filepath, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# -------------------------------------------------------
# 1. MUI importに Dialog, DialogTitle, DialogContent, DialogActions, FormControl, Select, MenuItem を追加
# -------------------------------------------------------
old_mui_import = '''import {
  Container,
  Box,
  Typography,
  Paper,
  Button,
  CircularProgress,
  IconButton,
  Snackbar,
  Alert,
  Grid,
  TextField,
  Link,
} from '@mui/material';'''

new_mui_import = '''import {
  Container,
  Box,
  Typography,
  Paper,
  Button,
  CircularProgress,
  IconButton,
  Snackbar,
  Alert,
  Grid,
  TextField,
  Link,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  Select,
  MenuItem,
} from '@mui/material';'''

if 'Dialog,' not in text:
    text = text.replace(old_mui_import, new_mui_import, 1)
    print('✅ MUI importに Dialog/FormControl/Select/MenuItem を追加しました')
else:
    print('ℹ️  Dialog は既にimportされています')

# -------------------------------------------------------
# 2. salesContractDialog の重複定義を削除
#    2つある場合、1つだけ残す
# -------------------------------------------------------
duplicate_state = '  const [salesContractDialog, setSalesContractDialog] = useState(false);\n  const [salesContractDialog, setSalesContractDialog] = useState(false);'
single_state = '  const [salesContractDialog, setSalesContractDialog] = useState(false);'

if duplicate_state in text:
    text = text.replace(duplicate_state, single_state, 1)
    print('✅ salesContractDialog の重複定義を削除しました')
else:
    print('ℹ️  salesContractDialog の重複はありません')

# -------------------------------------------------------
# 書き込み
# -------------------------------------------------------
with open(filepath, 'wb') as f:
    f.write(text.encode('utf-8'))

print('\n✅ 完了！')
