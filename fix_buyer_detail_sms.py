#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BuyerDetailPage.tsx の SMS送信者名表示バグ修正スクリプト

修正1: Activity インターフェースの employee.id 型を number → string に変更
修正2: SMS送信者の displayName 計算ロジックを修正
"""

import sys

file_path = 'frontend/frontend/src/pages/BuyerDetailPage.tsx'

with open(file_path, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 修正1: Activity インターフェースの employee.id 型を number → string に変更
old_interface = """interface Activity {
  id: number;
  action: string;
  target_type: string;
  target_id: number;
  metadata: any;
  created_at: string;
  employee?: {
    id: number;
    name: string;
    initials: string;
  };
}"""

new_interface = """interface Activity {
  id: number;
  action: string;
  target_type: string;
  target_id: number;
  metadata: any;
  created_at: string;
  employee?: {
    id: string;
    name: string;
    initials: string;
  };
}"""

if old_interface in text:
    text = text.replace(old_interface, new_interface)
    print('修正1: Activity インターフェースの employee.id 型を number → string に変更しました')
else:
    print('エラー: 修正1の対象コードが見つかりませんでした', file=sys.stderr)
    sys.exit(1)

# 修正2: SMS送信者の displayName 計算ロジックを修正
# isSms の直後の行にある displayName の計算を、SMS/メール共通の行から
# SMS専用のロジックに変更する
old_display_name = "                    const displayName = activity.employee ? getDisplayName(activity.employee) : '不明';"

new_display_name = """                    const displayName = isSms
                      ? (activity.employee
                          ? (activity.employee.name
                              ? activity.employee.name.split(/[\\s\\u3000]/)[0]
                              : (activity.employee.initials || '担当者'))
                          : '担当者')
                      : (activity.employee ? getDisplayName(activity.employee) : '不明');"""

if old_display_name in text:
    text = text.replace(old_display_name, new_display_name)
    print('修正2: SMS送信者の displayName 計算ロジックを修正しました')
else:
    print('エラー: 修正2の対象コードが見つかりませんでした', file=sys.stderr)
    sys.exit(1)

# UTF-8（BOMなし）で書き込む
with open(file_path, 'wb') as f:
    f.write(text.encode('utf-8'))

print('完了: BuyerDetailPage.tsx を正常に更新しました')

# BOMチェック
with open(file_path, 'rb') as f:
    first_bytes = f.read(3)
if first_bytes == b'\xef\xbb\xbf':
    print('警告: BOM付きUTF-8が検出されました')
else:
    print('エンコーディング確認: BOMなしUTF-8 (正常)')
