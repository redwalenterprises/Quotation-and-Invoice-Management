export function taxPercentFromLabel(label) {
  const match = String(label || '').match(/(\d+)%/);
  return match ? Number(match[1]) : 0;
}

export function rowCalc(row) {
  const qty = Number(row.qty) || 0;
  const price = Number(row.price) || 0;
  const base = qty * price;

  const discountAmount = row.discountAmount !== ''
    ? Number(row.discountAmount) || 0
    : base * (Number(row.discountPercent) || 0) / 100;

  const afterDiscount = base - discountAmount;
  const taxPercent = taxPercentFromLabel(row.taxRate);
  const taxAmount = afterDiscount * taxPercent / 100;

  return { base, discountAmount, taxPercent, taxAmount, amount: afterDiscount + taxAmount };
}