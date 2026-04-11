import target_file
target = 'backend/src/services/__tests__/seller-sidebar-count-mismatch-bug.preservation.test.ts'
content = open('preservation_test_content.ts', 'rb').read()
with open(target, 'wb') as f:
    f.write(content)
print('done')
