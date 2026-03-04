export interface UvLevel {
  level: 'low' | 'moderate' | 'high' | 'veryHigh' | 'extreme';
  color: string;
}

export function getUvLevel(index: number): UvLevel {
  const floored = Math.floor(index);
  if (floored <= 2) return { level: 'low', color: '#4ade80' };
  if (floored <= 5) return { level: 'moderate', color: '#facc15' };
  if (floored <= 7) return { level: 'high', color: '#fb923c' };
  if (floored <= 10) return { level: 'veryHigh', color: '#ef4444' };
  return { level: 'extreme', color: '#a855f7' };
}
