with open('frontend/frontend/src/components/PriceSection.tsx', 'rb') as f:
    content = f.read()
text = content.decode('utf-8')
print('BOM:', repr(content[:3]))
print('Has ImageSelectorModal import:', 'ImageSelectorModal' in text)
print('Has old handler:', 'handleSendPriceReductionChat' in text)
print('Has selectedImageUrl state:', 'selectedImageUrl' in text)
print('Has imageSelectorOpen state:', 'imageSelectorOpen' in text)
print('Has handleConfirmSend:', 'handleConfirmSend' in text)
