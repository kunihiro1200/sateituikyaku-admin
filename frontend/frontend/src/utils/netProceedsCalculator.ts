export interface NetProceedsRow {
  price: number;
  brokerageFee: number;
  stampDuty: number;
  netProceeds: number;
}

export const calculateSaleContractStampDuty = (price: number): number => {
  if (price <= 5_000_000) return 1_000;
  if (price <= 10_000_000) return 5_000;
  if (price <= 50_000_000) return 10_000;
  if (price <= 100_000_000) return 30_000;
  if (price <= 500_000_000) return 60_000;
  if (price <= 1_000_000_000) return 160_000;
  return 320_000;
};

export const calculateBrokerageFee = (price: number): number => {
  if (price <= 8_000_000) return 330_000;
  return Math.round((price * 0.03 + 60_000) * 1.1);
};

export const calculateNetProceedsRows = (
  valuationAmounts: Array<number | null | undefined>
): NetProceedsRow[] => {
  const amounts = valuationAmounts.filter(
    (amount): amount is number => typeof amount === 'number' && amount > 0
  );
  if (amounts.length === 0) return [];

  const minimumAmount = Math.min(...amounts);
  const maximumAmount = Math.max(...amounts);
  const prices: number[] = [];
  for (let price = maximumAmount; price >= minimumAmount; price -= 2_000_000) {
    prices.push(price);
  }
  if (prices[prices.length - 1] !== minimumAmount) prices.push(minimumAmount);

  return prices.map((price) => {
    const brokerageFee = calculateBrokerageFee(price);
    const stampDuty = calculateSaleContractStampDuty(price);
    return { price, brokerageFee, stampDuty, netProceeds: price - brokerageFee - stampDuty };
  });
};

export const formatNetProceedsSection = (
  valuationAmounts: Array<number | null | undefined>,
  lineBreak = '\n'
): string => {
  const rows = calculateNetProceedsRows(valuationAmounts);
  if (rows.length === 0) return `【机上査定による手残り金額】${lineBreak}査定額：未設定`;

  const proceedsLines = rows.map(({ price, netProceeds }) =>
    `${Math.round(price / 10_000)}万円 手残り金額→${Math.round(netProceeds / 10_000)}万円`
  ).join(lineBreak);
  const brokerageDescription = rows[0].price <= 8_000_000
    ? '仲介手数料（税込：一律33万円）'
    : '仲介手数料（売買価格×3％＋6万円に消費税）';
  const note = `※${brokerageDescription}と、売買価格に応じた売買契約書の印紙代を差し引いた概算です。譲渡所得税や抵当権抹消費用は含まれておりません。詳細は当社へお尋ねください。`;

  return `【机上査定による手残り金額】${lineBreak}${proceedsLines}${lineBreak}${lineBreak}${note}`;
};

const formatDetailedAmount = (amount: number): string => {
  const tenThousands = Math.floor(amount / 10_000);
  const yen = amount % 10_000;
  return yen === 0 ? `${tenThousands}万円` : `${tenThousands}万${yen}円`;
};

export const formatNetProceedsEmailSection = (
  valuationAmounts: Array<number | null | undefined>
): string => {
  const rows = calculateNetProceedsRows(valuationAmounts);
  if (rows.length === 0) return '【机上査定による手残り金額】\n査定額：未設定';

  const detailLines = rows.map(({ price, brokerageFee, stampDuty, netProceeds }) =>
    `${formatDetailedAmount(price)}　${formatDetailedAmount(brokerageFee)}　${formatDetailedAmount(stampDuty)}　${formatDetailedAmount(netProceeds)}`
  ).join('\n');
  const brokerageDescription = rows[0].price <= 8_000_000
    ? '仲介手数料（税込：一律33万円）'
    : '仲介手数料（売買価格×3％＋6万円に消費税）';
  const note = `※${brokerageDescription}と、売買価格に応じた売買契約書の印紙代を差し引いた概算です。譲渡所得税や抵当権抹消費用は含まれておりません。詳細は当社へお尋ねください。`;

  return `【机上査定による手残り金額】\n売買価格　仲介手数料　印紙代　手残り\n${detailLines}\n\n${note}`;
};