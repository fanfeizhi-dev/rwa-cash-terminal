export function getMetricStatus(score: number): { label: string; colorClasses: string } {
  if (score <= 25) {
    return {
      label: 'OPTIMAL',
      colorClasses: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
    };
  }
  if (score <= 50) {
    return {
      label: 'STRONG',
      colorClasses: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
    };
  }
  if (score <= 75) {
    return {
      label: 'MONITOR',
      colorClasses: 'bg-yellow-50 text-yellow-700 border border-yellow-100',
    };
  }
  return {
    label: 'ELEVATED',
    colorClasses: 'bg-red-50 text-red-600 border border-red-100',
  };
}
