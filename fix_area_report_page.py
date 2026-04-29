# encoding: utf-8
with open('frontend/frontend/src/pages/AreaReportPage.tsx', 'rb') as f:
    text = f.read().decode('utf-8')

# generate関数全体を置換
start = '  const generate = async () => {'
end = '  };'

start_idx = text.find(start)
# generateの終わりを探す（useEffectの前）
end_idx = text.find('\n  useEffect(', start_idx)

print(f'start: {start_idx}, end: {end_idx}')
print('Current generate function:')
print(repr(text[start_idx:start_idx+200]))
