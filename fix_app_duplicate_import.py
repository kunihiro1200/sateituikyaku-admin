#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
App.tsx の重複 import を修正
"""

with open('frontend/frontend/src/App.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 重複している import を1行に修正
old_dup = """import PropertyListingDetailPage from './pages/PropertyListingDetailPage';
import PropertyReportPage from './pages/PropertyReportPage';
import PropertyReportPage from './pages/PropertyReportPage';"""
new_dup = """import PropertyListingDetailPage from './pages/PropertyListingDetailPage';
import PropertyReportPage from './pages/PropertyReportPage';"""
text = text.replace(old_dup, new_dup)

with open('frontend/frontend/src/App.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done! Duplicate import removed.')
