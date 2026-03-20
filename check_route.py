with open('backend/src/routes/sellers.ts', 'rb') as f:
    content = f.read()
text = content.decode('utf-8')

# GET /:id のルートを探す
idx = text.find("router.get('/:id'")
if idx == -1:
    idx = text.find('router.get("/:id"')
end = text.find('\n});', idx) + 4
print(text[idx:end])
