with open('frontend/frontend/src/components/FollowUpLogHistoryTable.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

old = '''      {data.length === 0 && !error ? (
        <div className="p-8 text-center bg-gray-50 rounded-lg">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="mt-2 text-sm text-gray-500">この売主の履歴データはありません</p>
        </div>'''

new = '''      {data.length === 0 && !error ? (
        <div className="py-3 text-center">
          <p className="text-sm text-gray-400">この売主の履歴データはありません</p>
        </div>'''

if old in text:
    text = text.replace(old, new)
    with open('frontend/frontend/src/components/FollowUpLogHistoryTable.tsx', 'wb') as f:
        f.write(text.encode('utf-8'))
    print('Done!')
else:
    print('ERROR: target string not found')
    idx = text.find('data.length === 0')
    print(repr(text[idx:idx+300]))
