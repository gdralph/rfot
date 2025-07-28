import type { OpportunityLineItem, ServiceLineOfferingMapping, ServiceLine } from '../types/index.js';

/**
 * Count unique offerings for a service line based on consolidated offering mappings
 */
export function countServiceLineOfferings(
  lineItems: OpportunityLineItem[],
  serviceLine: ServiceLine,
  mappings: ServiceLineOfferingMapping[]
): number {
  // Get all internal service and simplified offering combinations for this service line
  const serviceMappings = mappings.filter(mapping => mapping.service_line === serviceLine);

  if (serviceMappings.length === 0) {
    return 0;
  }

  // Find line items that match the mapped combinations
  const matchingLineItems = lineItems.filter(item => 
    item.internal_service && item.simplified_offering &&
    serviceMappings.some(mapping => 
      mapping.internal_service === item.internal_service &&
      mapping.simplified_offering === item.simplified_offering
    )
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
 * Determine which service line a line item belongs to based on consolidated offering mappings
 */
export function getLineItemServiceLine(
  lineItem: OpportunityLineItem,
  mappings: ServiceLineOfferingMapping[]
): ServiceLine | null {
  if (!lineItem.internal_service || !lineItem.simplified_offering) {
    return null;
  }

  const mapping = mappings.find(m => 
    m.internal_service === lineItem.internal_service &&
    m.simplified_offering === lineItem.simplified_offering
  );
  return mapping ? mapping.service_line as ServiceLine : null;
}

/**
 * Get all service lines that have offering mappings configured
 */
export function getServiceLinesWithMappings(
  mappings: ServiceLineOfferingMapping[]
): ServiceLine[] {
  const serviceLinesWithMappings = new Set(
    mappings.map(mapping => mapping.service_line as ServiceLine)
  );
  
  return Array.from(serviceLinesWithMappings);
}