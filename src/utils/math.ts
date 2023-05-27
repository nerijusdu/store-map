export function between(val: number, refA: number, refB: number, included = true): boolean {
  if (refA > refB) {
    const refT = refA;
    refA = refB;
    refB = refT;
  }
  return included ? val >= refA && val <= refB : val > refA && val < refB;
}

export function round(x: number, digits: number): number {
  return parseFloat(x.toFixed(digits));
}
