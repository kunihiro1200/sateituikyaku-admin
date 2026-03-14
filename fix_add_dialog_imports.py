# -*- coding: utf-8 -*-
"""
Dialog, TextField などのimportを追加する
"""

with open('frontend/frontend/src/pages/BuyerViewingResultPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

old_import = """import {
  Container,
  Box,
  Typography,
  Paper,
  Button,
  CircularProgress,
  IconButton,
  Chip,
  Alert,
  Tooltip,
  Snackbar,
} from '@mui/material';"""

new_import = """import {
  Container,
  Box,
  Typography,
  Paper,
  Button,
  CircularProgress,
  IconButton,
  Chip,
  Alert,
  Tooltip,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material';"""

result = text.replace(old_import, new_import, 1)

if result == text:
    print('ERROR: old_import not found!')
else:
    with open('frontend/frontend/src/pages/BuyerViewingResultPage.tsx', 'wb') as f:
        f.write(result.encode('utf-8'))
    print('Done!')
