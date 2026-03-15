with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

old = "onClick={() => navigate(`/property-listings/${propertyNumber}/report`)}"
new = "onClick={() => window.open(`/property-listings/${propertyNumber}/report`, '_blank')}"

if old in text:
    text = text.replace(old, new)
    with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'wb') as f:
        f.write(text.encode('utf-8'))
    print('Done!')
else:
    print('NOT FOUND')
