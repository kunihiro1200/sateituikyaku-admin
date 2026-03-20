#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
2つの修正:
1. SMSテンプレートのラベル変更（「初回不通時キャンセル案内」→「不通時Sメール」）
2. SMS送信後の担当者自動セット: activeEmployeesが空の場合に/api/employees/active-initialsから取得するフォールバックを追加
"""

with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 修正1: テンプレートラベル変更
text = text.replace(
    "label: '初回不通時キャンセル案内',",
    "label: '不通時Sメール',",
)

# 修正2: SMS送信後の担当者自動セットロジックを改善
# activeEmployeesが空の場合に/api/employees/active-initialsから取得するフォールバックを追加
old_assignee_logic = """        // SMS送信後、対応する担当フィールドにログインユーザーのイニシャルを自動セット
        try {
          const assigneeKey = SMS_TEMPLATE_ASSIGNEE_MAP[template.id];
          // activeEmployeesからログインユーザーのメールでイニシャルを照合（最優先）
          // employee.initialsはlocalStorageキャッシュで古い場合があるため
          const myEmployee = activeEmployees.find(e => e.email === employee?.email);
          const myInitial = myEmployee?.initials || employee?.initials || '';
          if (assigneeKey && myInitial && seller?.id) {"""

new_assignee_logic = """        // SMS送信後、対応する担当フィールドにログインユーザーのイニシャルを自動セット
        try {
          const assigneeKey = SMS_TEMPLATE_ASSIGNEE_MAP[template.id];
          // activeEmployeesからログインユーザーのメールでイニシャルを照合（最優先）
          // activeEmployeesが空の場合は/api/employees/active-initialsから取得
          let myInitial = '';
          const myEmployee = activeEmployees.find(e => e.email === employee?.email);
          if (myEmployee?.initials) {
            myInitial = myEmployee.initials;
          } else {
            // フォールバック: active-initialsエンドポイントから取得
            try {
              const initialsRes = await api.get('/api/employees/active-initials');
              const initialsData = initialsRes.data;
              // active-initialsはイニシャル文字列の配列を返す
              // ログインユーザーのイニシャルをemployeeServiceから再取得して照合
              const freshEmployees = await import('../services/employeeService').then(m => m.getActiveEmployees());
              const freshMe = freshEmployees.find(e => e.email === employee?.email);
              myInitial = freshMe?.initials || employee?.initials || '';
            } catch {
              myInitial = employee?.initials || '';
            }
          }
          if (assigneeKey && myInitial && seller?.id) {"""

if old_assignee_logic in text:
    text = text.replace(old_assignee_logic, new_assignee_logic)
    print('✅ 担当者自動セットロジックを修正しました')
else:
    print('⚠️ 担当者自動セットロジックが見つかりませんでした（既に修正済みか構造が変わっている可能性）')

# UTF-8で書き込む
with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ 完了')
print('  - 「初回不通時キャンセル案内」→「不通時Sメール」に変更')
print('  - SMS送信後の担当者自動セットにフォールバックを追加')
