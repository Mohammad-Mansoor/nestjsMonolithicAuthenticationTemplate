import * as crypto from 'crypto';

/**
 * Generates a stable Redis cache key that safely separates namespaces, base keys,
 * and hashed query parameters.
 *
 * Example output:
 *   auth:role:roles:list:en:3f8ac1b9d2
 *
 * @param namespace   e.g. 'auth:role'   → microservice + module
 * @param baseKey     e.g. 'roles:list'  → resource type
 * @param query       Any query object (filters, pagination, language)
 */
export function generateCacheKey(
  namespace: string,
  baseKey: string,
  query: Record<string, any> = {},
): string {
  // Extract language for clarity
  const lang = query?.lang || 'en';

  // Remove language from query to avoid duplicate keys if you dont want language base cache
  // if you want language base cacheing then comment this line
  // and in the end of this function where it is returning the key we should add lang variable in the key check return line i have comment there also
  delete query.lang;

  // Create a stable hash from query params (ignore order)
  const queryString = JSON.stringify(
    Object.keys(query)
      .sort()
      .reduce(
        (obj, key) => {
          obj[key] = query[key];
          return obj;
        },
        {} as Record<string, any>,
      ),
  );

  const hash = crypto
    .createHash('md5')
    .update(queryString)
    .digest('hex')
    .slice(0, 10);


    // if you want language base cacheing then unccoment this line and comment the below line
  // return `${namespace}:${baseKey}:${lang}:${hash}`;
  return `${namespace}:${baseKey}:${hash}`;
}