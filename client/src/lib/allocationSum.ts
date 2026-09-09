/**
 * Calculates sum of target percentages and validates 100% distribution.
 */

export interface AllocationSumResult {
  total: number;
  remaining: number;
  isExact100: boolean;
  isValid: boolean;
}

export function calculateAllocationSum(values: (string | number | null | undefined)[]): AllocationSumResult {
  const sum = values.reduce<number>((acc, val) => {
    if (val === null || val === undefined || val === "") return acc;
    const num = typeof val === "number" ? val : parseFloat(String(val).replace(/,/g, "."));
    return isNaN(num) ? acc : acc + num;
  }, 0);

  // Round to 4 decimal places to prevent floating point precision issues (e.g. 99.99999999999999)
  const roundedSum = Math.round(sum * 10000) / 10000;
  const roundedRemaining = Math.round((100 - roundedSum) * 10000) / 10000;
  const isExact100 = Math.abs(roundedSum - 100) < 0.0001;

  return {
    total: roundedSum,
    remaining: roundedRemaining,
    isExact100,
    isValid: isExact100,
  };
}
