#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""App.tsxにAPIウォームアップを追加する"""

with open('frontend/frontend/src/App.tsx', 'rb') as f:
    content = f.read().decode('utf-8')

# importを追加
old_import = "import { Routes, Route, Navigate } from 'react-router-dom';\nimport { useEffect } from 'react';"
new_import = "import { Routes, Route, Navigate } from 'react-router-dom';\nimport { useEffect } from 'react';\nimport { warmupApi } from './utils/apiWarmup';"

content = content.replace(old_import, new_import, 1)

# ウォームアップ呼び出しを追加
old_effect = "  // アプリ起動時に認証状態を確認\n  useEffect(() => {\n    checkAuth();\n  }, [checkAuth]);"
new_effect = "  // アプリ起動時に認証状態を確認\n  useEffect(() => {\n    checkAuth();\n    // Vercelコールドスタート対策：バックエンドAPIをウォームアップ\n    warmupApi();\n  }, [checkAuth]);"

content = content.replace(old_effect, new_effect, 1)

with open('frontend/frontend/src/App.tsx', 'wb') as f:
    f.write(content.encode('utf-8'))

print('✅ App.tsx updated')
