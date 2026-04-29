import subprocess
result = subprocess.run(
    ['git', 'show', 'b52e22ee:frontend/frontend/src/components/HouseMakerModal.tsx'],
    capture_output=True
)
content = result.stdout
if len(content) > 100:
    with open('frontend/frontend/src/components/HouseMakerModal.tsx', 'wb') as f:
        f.write(content)
    print(f'Done! {len(content)} bytes written.')
else:
    print('ERROR:', repr(content[:200]))
    print('stderr:', result.stderr[:200])
