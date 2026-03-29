#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
send-template-emailのrequestPayloadに送信者イニシャルを含めるよう修正
フロントエンドでイニシャルを解決してバックエンドに渡す
"""

filepath = 'frontend/frontend/src/pages/CallModePage.tsx'

with open(filepath, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 修正前: requestPayloadにsenderInitialsがない
old_payload = (
    '          const requestPayload = {\n'
    '            templateId: template.id,\n'
    '            to: capturedEmailRecipient,\n'
    '            subject: capturedEmailSubject,\n'
    '            content: capturedEmailBody,\n'
    '            htmlBody: capturedEmailBody, // \u5e38\u306bHTML\u3068\u3057\u3066\u6e21\u3059\uff08<br>\u304c\u305d\u306e\u307e\u307e\u8868\u793a\u3055\u308c\u308b\u554f\u984c\u3092\u4fee\u6b63\uff09\n'
    '            from: capturedSenderAddress,\n'
    '            // \u753b\u50cf\u304c\u9078\u629e\u3055\u308c\u3066\u3044\u308b\u5834\u5408\u306e\u307f attachments \u3092\u542b\u3081\u308b\n'
    '            ...(attachmentImages.length > 0\n'
    '              ? { attachments: attachmentImages }\n'
    '              : {}),\n'
    '          };'
)

# 修正後: senderInitialsを解決してrequestPayloadに含める
new_payload = (
    '          // \u9001\u4fe1\u8005\u30a4\u30cb\u30b7\u30e3\u30eb\u3092\u30d5\u30ed\u30f3\u30c8\u30a8\u30f3\u30c9\u3067\u89e3\u6c7a\u3057\u3066\u30d0\u30c3\u30af\u30a8\u30f3\u30c9\u306b\u6e21\u3059\n'
    '          let resolvedSenderInitials = \'\';\n'
    '          {\n'
    '            // 1. activeEmployees\u304b\u3089\u30e1\u30fc\u30eb\u3067\u30de\u30c3\u30c1\u30f3\u30b0\n'
    '            const myEmp = activeEmployees.find(e => e.email === employee?.email);\n'
    '            if (myEmp?.initials) {\n'
    '              resolvedSenderInitials = myEmp.initials;\n'
    '            } else if (employee?.initials) {\n'
    '              // 2. authStore\u306eemployee.initials\n'
    '              resolvedSenderInitials = employee.initials;\n'
    '            } else {\n'
    '              // 3. normalInitials\u306e\u4e2d\u304b\u3089activeEmployees\u3067\u7167\u5408\n'
    '              try {\n'
    '                const freshEmps = await import(\'../services/employeeService\').then(m => m.getActiveEmployees());\n'
    '                const freshMe = freshEmps.find(e => e.email === employee?.email);\n'
    '                if (freshMe?.initials) resolvedSenderInitials = freshMe.initials;\n'
    '              } catch { /* ignore */ }\n'
    '            }\n'
    '          }\n'
    '\n'
    '          const requestPayload = {\n'
    '            templateId: template.id,\n'
    '            to: capturedEmailRecipient,\n'
    '            subject: capturedEmailSubject,\n'
    '            content: capturedEmailBody,\n'
    '            htmlBody: capturedEmailBody, // \u5e38\u306bHTML\u3068\u3057\u3066\u6e21\u3059\uff08<br>\u304c\u305d\u306e\u307e\u307e\u8868\u793a\u3055\u308c\u308b\u554f\u984c\u3092\u4fee\u6b63\uff09\n'
    '            from: capturedSenderAddress,\n'
    '            senderInitials: resolvedSenderInitials, // \u9001\u4fe1\u8005\u30a4\u30cb\u30b7\u30e3\u30eb\uff08\u30d0\u30c3\u30af\u30a8\u30f3\u30c9\u3067\u81ea\u52d5\u30bb\u30c3\u30c8\u7528\uff09\n'
    '            // \u753b\u50cf\u304c\u9078\u629e\u3055\u308c\u3066\u3044\u308b\u5834\u5408\u306e\u307f attachments \u3092\u542b\u3081\u308b\n'
    '            ...(attachmentImages.length > 0\n'
    '              ? { attachments: attachmentImages }\n'
    '              : {}),\n'
    '          };'
)

if old_payload not in text:
    print('ERROR: requestPayload\u306e\u5bfe\u8c61\u30b3\u30fc\u30c9\u304c\u898b\u3064\u304b\u308a\u307e\u305b\u3093')
    idx = text.find('const requestPayload = {')
    if idx >= 0:
        print('\u5468\u8fba\u30c6\u30ad\u30b9\u30c8:')
        print(repr(text[idx-200:idx+400]))
    import sys; sys.exit(1)

text = text.replace(old_payload, new_payload, 1)
print('OK: requestPayload\u306bsenderInitials\u3092\u8ffd\u52a0\u3057\u307e\u3057\u305f')

with open(filepath, 'wb') as f:
    f.write(text.encode('utf-8'))

# BOM\u30c1\u30a7\u30c3\u30af
with open(filepath, 'rb') as f:
    head = f.read(3)
print(f'BOM check: {repr(head)} (should NOT be b"\\xef\\xbb\\xbf")')
print('Done!')
