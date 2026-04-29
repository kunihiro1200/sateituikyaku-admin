import subprocess
result = subprocess.run(
    ['git', 'show', '3560f364:frontend/frontend/src/components/HouseMakerModal.tsx'],
    capture_output=True
)
content = result.stdout
if len(content) > 100:
    with open('frontend/frontend/src/components/HouseMakerModal.tsx', 'wb') as f:
        f.write(content)
    print(f'Done! {len(content)} bytes written.')
else:
    print('ERROR: content too short:', repr(content[:100]))
