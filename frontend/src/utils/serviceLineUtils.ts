import type { OpportunityLineItem, ServiceLineInternalServiceMapping, ServiceLine } from '../types/index.js';

/**
 * Count unique offerings for a service line based on internal service mappings
 */
export function countServiceLineOfferings(
  lineItems: OpportunityLineItem[],
  serviceLine: ServiceLine,
  mappings: ServiceLineInternalServiceMapping[]
): number {
  // Get all internal services mapped to this service line
  const mappedInternalServices = mappings
    .filter(mapping => mapping.service_line === serviceLine)
    .map(mapping => mapping.internal_service);

  if (mappedInternalServices.length === 0) {
    return 0;
  }

  // Find line items that match the mapped internal services
  const matchingLineItems = lineItems.filter(item => 
    item.internal_service && mappedInternalServices.includes(item.internal_service)
  );

  // Count unique simplified offerings
  const uniqueOfferings = new Set(
    matchingLineItems
      .map(item => item.simplified_offering)
      .filter(offering => offering && offering.trim() !== '')
  );

  return uniqueOfferings.size;
}

/**
 * Determine which service line a line item belongs to based on internal service mappings
 */
export function getLineItemServiceLine(
  lineItem: OpportunityLineItem,
  mappings: ServiceLineInternalServiceMapping[]
): ServiceLine | null {
  if (!lineItem.internal_service) {
    return null;
  }

  const mapping = mappings.find(m => m.internal_service === lineItem.internal_service);
  return mapping ? mapping.service_line as ServiceLine : null;
}

/**
 * Get all service lines that have internal service mappings configured
 */
export function getServiceLinesWithMappings(
  mappings: ServiceLineInternalServiceMapping[]
): ServiceLine[] {
  const serviceLinesWithMappings = new Set(
    mappings.map(mapping => mapping.service_line as ServiceLine)
  );
  
  return Array.from(serviceLinesWithMappings);
}