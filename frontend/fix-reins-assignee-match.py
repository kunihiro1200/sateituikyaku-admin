#!/usr/bin/env python3
# -*- coding: utf-8 -*-
with open('frontend/frontend/src/pages/ReinsRegistrationPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 修正前: 完全一致のみ
old = """      const assigneeEmployee = employees.find(
        (e) => e.initials === assignee || e.name === assignee
      );"""

# 修正後: 完全一致 + 部分一致（nameにassigneeが含まれる、またはassigneeにinitialsが含まれる）
new = """      const assigneeEmployee = employees.find(
        (e) =>
          e.initials === assignee ||
          e.name === assignee ||
          (assignee && e.name.includes(assignee)) ||
          (assignee && assignee.includes(e.initials || ''))
      );"""

if old in text:
    text = text.replace(old, new)
    print("OK: assignee matching fix applied")
else:
    print("NOT FOUND: target string not found")

with open('frontend/frontend/src/pages/ReinsRegistrationPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print("Done")
