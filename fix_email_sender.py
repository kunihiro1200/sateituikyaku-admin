with open('frontend/frontend/src/pages/BuyerCandidateListPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# "from" -> "senderAddress" に修正
old = """        return await api.post('/api/emails/send-distribution', {
          recipients: [candidate.email!],
          subject: subject,
          body: personalizedBody,
          from: 'tenant@ifoo-oita.com',
          cc: 'tenant@ifoo-oita.com',
        });"""

new = """        return await api.post('/api/emails/send-distribution', {
          senderAddress: 'tenant@ifoo-oita.com',
          recipients: [candidate.email!],
          subject: subject,
          body: personalizedBody,
        });"""

if old in text:
    text = text.replace(old, new)
    print('✅ Replaced successfully')
else:
    print('❌ Pattern not found')

with open('frontend/frontend/src/pages/BuyerCandidateListPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
