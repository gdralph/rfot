export const getSecurityClearanceColorClass = (securityClearance?: string): string => {
  if (!securityClearance) return '';
  
  switch (securityClearance.toUpperCase()) {
    case 'BPSS':
      return 'text-blue-600';
    case 'SC':
      return 'text-orange-600';
    case 'DV':
      return 'text-red-600';
    default:
      return '';
  }
};