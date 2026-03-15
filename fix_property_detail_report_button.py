#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PropertyListingDetailPage.tsx に「報告」ボタンを追加
"""

with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 1. AssignmentIcon を import に追加
old_import_icons = """import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  OpenInNew as OpenInNewIcon,
  ContentCopy as ContentCopyIcon,
  Check as CheckIcon,
  Person as PersonIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
} from '@mui/icons-material';"""
new_import_icons = """import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  OpenInNew as OpenInNewIcon,
  ContentCopy as ContentCopyIcon,
  Check as CheckIcon,
  Person as PersonIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Assignment as AssignmentIcon,
} from '@mui/icons-material';"""
text = text.replace(old_import_icons, new_import_icons)

# 2. 「報告」ボタンを「買主候補リスト」ボタンの前に追加
old_buttons = """        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<PersonIcon />}
            onClick={handleOpenBuyerCandidates}"""
new_buttons = """        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<AssignmentIcon />}
            onClick={() => navigate(`/property-listings/${propertyNumber}/report`)}
            sx={{
              borderColor: '#7b1fa2',
              color: '#7b1fa2',
              '&:hover': {
                borderColor: '#6a1b9a',
                backgroundColor: '#7b1fa208',
              },
            }}
          >
            報告
          </Button>
          <Button
            variant="outlined"
            startIcon={<PersonIcon />}
            onClick={handleOpenBuyerCandidates}"""
text = text.replace(old_buttons, new_buttons)

with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done! PropertyListingDetailPage.tsx updated with report button.')
