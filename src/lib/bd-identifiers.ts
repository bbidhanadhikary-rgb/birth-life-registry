export function normalizeBdDigits(value: string): string {
  return value
    .replace(/[০-৯]/g, (digit) => String("০১২৩৪৫৬৭৮৯".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
}

export function isValidBrn(value: string): boolean {
  return /^\d{17}$/.test(normalizeBdDigits(value));
}

export function isValidNid(value: string): boolean {
  return /^(?:\d{10}|\d{13}|\d{17})$/.test(normalizeBdDigits(value));
}
