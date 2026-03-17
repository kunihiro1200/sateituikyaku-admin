#!/usr/bin/env python3
# -*- coding: utf-8 -*-
with open('frontend/frontend/src/pages/ReinsRegistrationPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

old = "      const employees: Employee[] = empRes.data || [];"
new = "      const employees: Employee[] = empRes.data?.employees || empRes.data || [];"

if old in text:
    text = text.replace(old, new)
    print("OK: employees fix applied")
else:
    print("NOT FOUND: target string not found")

with open('frontend/frontend/src/pages/ReinsRegistrationPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print("Done")
