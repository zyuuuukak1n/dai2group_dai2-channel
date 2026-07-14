export function calculateMomentum(resCount: number, createdAtIsoString: string): number {
  const diffMs = Date.now() - new Date(createdAtIsoString).getTime();
  let diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffDays < 0.01) {
    diffDays = 0.01;
  }
  return Math.floor(resCount / diffDays);
}
