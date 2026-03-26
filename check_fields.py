with open('frontend/frontend/src/pages/NewBuyerPage.tsx', 'rb') as f:
    text = f.read().decode('utf-8')

si = text.find('{/* \u554f\u5408\u305b\u60c5\u5831 */}')
ei = text.find('{/* \u5e0c\u671b\u6761\u4ef6 */}')
print(f'Section: {si} to {ei}, length={ei-si}')
section = text[si:ei]

labels = [
    '\u696d\u8005\u5411\u3051\u30a2\u30f3\u30b1\u30fc\u30c8',
    '\u554f\u5408\u6642\u30d2\u30a2\u30ea\u30f3\u30b0',
    '\u521d\u52d5\u62c5\u5f53',
    '\u53d7\u4ed8\u65e5',
    '\u554f\u5408\u305b\u5143',
    '\u6700\u65b0\u72b6\u6cc1',
    '\u914d\u4fe1\u30e1\u30fc\u30eb',
    'Pinrich',
    '\u96fb\u8a71\u5bfe\u5fdc',
    '3\u56de\u6b7b\u96fb',
    '\u6b21\u96fb\u65e5',
    '\u554f\u5408\u6642\u6301\u5bb6',
    '\u6301\u5bb6\u30d2\u30a2\u30ea\u30f3\u30b0\u7d50\u679c',
    '\u8981\u67fb\u5b9a',
    'inquirySource.includes',
    'inquiryEmailPhone &&',
    'ownedHomeHearingInquiry &&',
]
for label in labels:
    found = label in section
    status = 'OK' if found else 'MISSING'
    print(status + ' ' + label)
