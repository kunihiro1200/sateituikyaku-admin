/**
 * inquiry_source が '2件目以降' かどうかを判定する
 */
export const isSecondInquiry = (inquirySource: string | null | undefined): boolean => {
  return inquirySource === '2件目以降';
};

/**
 * inquiry_source に基づいて pinrich の値を決定する
 * '2件目以降' の場合は '登録不要（不可）' を返す
 */
export const resolvePinrichValue = (
  inquirySource: string | null | undefined,
  currentPinrich: string | null | undefined
): string | null => {
  if (isSecondInquiry(inquirySource)) {
    return '登録不要（不可）';
  }
  return currentPinrich ?? null;
};
