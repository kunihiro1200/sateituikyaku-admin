#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CallModePage.tsx の active-initials fetch を api.get() に修正する
PropertyMapSection.tsx の fetch に認証ヘッダーを追加する
"""

import re

# ===== 1. CallModePage.tsx の修正 =====
filepath = 'frontend/frontend/src/pages/CallModePage.tsx'

with open(filepath, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# fetch('/api/employees/active-initials', ...) を api.get() に変更
old_code = """  // スタッフイニシャル一覧を取得
  useEffect(() => {
    const fetchActiveInitials = async () => {
      try {
        const response = await fetch('/api/employees/active-initials', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          setActiveEmployees(data.initials || []);
          console.log('✅ Loaded active staff initials:', data.initials);
        } else {
          console.error('Failed to fetch active staff initials');
        }
      } catch (error) {
        console.error('Error fetching active staff initials:', error);
      }
    };
    
    fetchActiveInitials();
  }, []);"""

new_code = """  // スタッフイニシャル一覧を取得
  useEffect(() => {
    const fetchActiveInitials = async () => {
      try {
        const response = await api.get('/api/employees/active-initials');
        setActiveEmployees(response.data.initials || []);
        console.log('✅ Loaded active staff initials:', response.data.initials);
      } catch (error) {
        console.error('Error fetching active staff initials:', error);
      }
    };
    
    fetchActiveInitials();
  }, []);"""

if old_code in text:
    text = text.replace(old_code, new_code)
    print('✅ CallModePage.tsx: active-initials fetch を api.get() に変更しました')
else:
    print('❌ CallModePage.tsx: 対象コードが見つかりませんでした')
    # デバッグ用に周辺を確認
    idx = text.find('active-initials')
    if idx >= 0:
        print(f'  active-initials が見つかった位置: {idx}')
        print(f'  周辺コード:\n{text[max(0,idx-200):idx+200]}')

with open(filepath, 'wb') as f:
    f.write(text.encode('utf-8'))

print(f'✅ {filepath} を保存しました')

# ===== 2. PropertyMapSection.tsx の修正 =====
filepath2 = 'frontend/frontend/src/components/PropertyMapSection.tsx'

with open(filepath2, 'rb') as f:
    content2 = f.read()

text2 = content2.decode('utf-8')

# import に api を追加
old_import = "import React, { useState, useEffect } from 'react';"
new_import = "import React, { useState, useEffect } from 'react';\nimport api from '../services/api';"

if old_import in text2:
    text2 = text2.replace(old_import, new_import)
    print('✅ PropertyMapSection.tsx: api import を追加しました')
else:
    print('❌ PropertyMapSection.tsx: import 行が見つかりませんでした')

# fetch(`${apiUrl}/api/sellers/by-number/${sellerNumber}`) を api.get() に変更
old_fetch = """        // バックエンドのAPIエンドポイントを呼び出す（売主番号で検索）
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
        const response = await fetch(`${apiUrl}/api/sellers/by-number/${sellerNumber}`);
        
        if (response.ok) {
          const data = await response.json();"""

new_fetch = """        // バックエンドのAPIエンドポイントを呼び出す（売主番号で検索）
        const response = await api.get(`/api/sellers/by-number/${sellerNumber}`);
        
        if (response.status === 200) {
          const data = response.data;"""

if old_fetch in text2:
    text2 = text2.replace(old_fetch, new_fetch)
    print('✅ PropertyMapSection.tsx: sellers/by-number fetch を api.get() に変更しました')
else:
    print('❌ PropertyMapSection.tsx: sellers/by-number fetch が見つかりませんでした')
    idx = text2.find('by-number')
    if idx >= 0:
        print(f'  周辺コード:\n{text2[max(0,idx-300):idx+300]}')

# fetch(`${apiUrl}/api/sellers/${data.id}/coordinates`, ...) を api.patch() に変更
old_save = """              // バックエンドに座標を保存（次回から高速化）
              try {
                await fetch(`${apiUrl}/api/sellers/${data.id}/coordinates`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    latitude: location.lat,
                    longitude: location.lng,
                  }),
                });
                console.log('🗺️ [PropertyMapSection] Coordinates saved to database');
              } catch (saveError) {
                console.warn('🗺️ [PropertyMapSection] Failed to save coordinates (display not affected):', saveError);
              }"""

new_save = """              // バックエンドに座標を保存（次回から高速化）
              try {
                await api.patch(`/api/sellers/${data.id}/coordinates`, {
                  latitude: location.lat,
                  longitude: location.lng,
                });
                console.log('🗺️ [PropertyMapSection] Coordinates saved to database');
              } catch (saveError) {
                console.warn('🗺️ [PropertyMapSection] Failed to save coordinates (display not affected):', saveError);
              }"""

if old_save in text2:
    text2 = text2.replace(old_save, new_save)
    print('✅ PropertyMapSection.tsx: coordinates save fetch を api.patch() に変更しました')
else:
    print('❌ PropertyMapSection.tsx: coordinates save fetch が見つかりませんでした')

# response.ok の残りを修正（fetchからaxiosに変わったため）
old_else = """        } else {
          console.warn('🗺️ [PropertyMapSection] Failed to fetch seller data:', response.status);
          setMapCoordinates(null);
        }"""

new_else = """        } else {
          console.warn('🗺️ [PropertyMapSection] Failed to fetch seller data:', response.status);
          setMapCoordinates(null);
        }"""

# try/catch で axios エラーをハンドリングするので else は不要だが、構造を維持
# axios は 2xx 以外で例外を投げるので、response.status === 200 の else は catch で処理される

with open(filepath2, 'wb') as f:
    f.write(text2.encode('utf-8'))

print(f'✅ {filepath2} を保存しました')
print('\n全ての修正が完了しました')
