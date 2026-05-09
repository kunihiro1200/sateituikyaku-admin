#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
EmailService.tsのContent-Transfer-Encodingをquoted-printableからbase64に修正
quoted-printableと宣言しているのに実際にエンコードしていないため
<a href="...">の=がGmailで正しく解釈されない問題を修正
"""

with open('backend/src/services/EmailService.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 添付なしの場合のrawMessage生成を修正
old_no_attachment = """      if (files.length === 0) {
        // 添付なし: シンプルな text/html メッセージ
        const messageParts = [
          `From: ${from}`,
          `To: ${params.to}`,
          `Subject: ${encodedSubject}`,
          'MIME-Version: 1.0',
          'Content-Type: text/html; charset=utf-8',
          'Content-Transfer-Encoding: quoted-printable',
          '',
          htmlBody,
        ];
        rawMessage = messageParts.join('\\n');
      } else {
        // 添付あり: multipart/mixed メッセージ
        const boundary = `boundary_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const parts: string[] = [
          `From: ${from}`,
          `To: ${params.to}`,
          `Subject: ${encodedSubject}`,
          'MIME-Version: 1.0',
          `Content-Type: multipart/mixed; boundary="${boundary}"`,
          '',
          `--${boundary}`,
          'Content-Type: text/html; charset=utf-8',
          'Content-Transfer-Encoding: quoted-printable',
          '',
          htmlBody,
        ];"""

new_no_attachment = """      if (files.length === 0) {
        // 添付なし: シンプルな text/html メッセージ（base64エンコード）
        const htmlBodyBase64 = Buffer.from(htmlBody, 'utf-8').toString('base64');
        const messageParts = [
          `From: ${from}`,
          `To: ${params.to}`,
          `Subject: ${encodedSubject}`,
          'MIME-Version: 1.0',
          'Content-Type: text/html; charset=utf-8',
          'Content-Transfer-Encoding: base64',
          '',
          htmlBodyBase64,
        ];
        rawMessage = messageParts.join('\\n');
      } else {
        // 添付あり: multipart/mixed メッセージ（base64エンコード）
        const htmlBodyBase64 = Buffer.from(htmlBody, 'utf-8').toString('base64');
        const boundary = `boundary_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const parts: string[] = [
          `From: ${from}`,
          `To: ${params.to}`,
          `Subject: ${encodedSubject}`,
          'MIME-Version: 1.0',
          `Content-Type: multipart/mixed; boundary="${boundary}"`,
          '',
          `--${boundary}`,
          'Content-Type: text/html; charset=utf-8',
          'Content-Transfer-Encoding: base64',
          '',
          htmlBodyBase64,
        ];"""

if old_no_attachment in text:
    text = text.replace(old_no_attachment, new_no_attachment)
    print('✅ 修正箇所が見つかりました。置換します。')
else:
    print('❌ 修正箇所が見つかりませんでした。')
    idx = text.find('quoted-printable')
    if idx >= 0:
        print(repr(text[idx-200:idx+200]))
    exit(1)

with open('backend/src/services/EmailService.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ EmailService.ts を修正しました。')

with open('backend/src/services/EmailService.ts', 'rb') as f:
    first_bytes = f.read(3)
print(f'BOMチェック: {repr(first_bytes[:3])}')
