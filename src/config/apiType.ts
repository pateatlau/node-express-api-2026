/**
 * Configuration helper for API type selection
 */

export type ApiType = 'rest' | 'graphql' | 'both';

/**
 * Get the API type from environment variable
 * Defaults to 'both' if not specified
 */
export function getApiType(): ApiType {
  const apiType = process.env.API_TYPE?.toLowerCase();

  if (apiType === 'rest' || apiType === 'graphql' || apiType === 'both') {
    return apiType;
  }

  // Default to both for backward compatibility
  return 'both';
}

/**
 * Check if REST API should be enabled
 */
export function isRestEnabled(): boolean {
  const apiType = getApiType();
  return apiType === 'rest' || apiType === 'both';
}

/**
 * Check if GraphQL API should be enabled
 */
export function isGraphQLEnabled(): boolean {
  const apiType = getApiType();
  return apiType === 'graphql' || apiType === 'both';
}
