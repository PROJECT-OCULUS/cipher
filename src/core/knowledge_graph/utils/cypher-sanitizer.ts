/**
 * Cypher Query Sanitization Utilities
 *
 * Prevents Cypher injection attacks in Neo4j queries by validating
 * and escaping identifiers (labels, property keys, relationship types).
 *
 * @module knowledge_graph/utils/cypher-sanitizer
 */

/**
 * Patterns that indicate potential Cypher injection attempts.
 * These include brackets, comments, keywords, and statement terminators.
 */
const CYPHER_DANGEROUS_PATTERNS = [
  /[)([\]{}]/,                        // Brackets/parens
  /--/,                               // Line comment
  /\/\*/,                             // Block comment start
  /MATCH|DELETE|CREATE|MERGE|SET|REMOVE|DETACH|RETURN|WHERE|WITH|CALL|YIELD/i,
  /[\r\n]/,                           // Newlines
  /;/,                                // Statement terminator
];

/**
 * Pattern for identifiers that don't need escaping.
 * Matches standard identifier format: starts with letter or underscore,
 * followed by letters, numbers, or underscores.
 */
const SAFE_IDENTIFIER_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/**
 * Maximum allowed length for Cypher identifiers.
 * Neo4j has a limit of 65534 characters for identifiers.
 */
const MAX_IDENTIFIER_LENGTH = 65534;

/**
 * Validates that a Cypher identifier is safe to use in queries.
 *
 * @param identifier - The identifier to validate
 * @returns true if the identifier is safe, false otherwise
 *
 * @example
 * ```typescript
 * isValidCypherIdentifier('name')           // true
 * isValidCypherIdentifier('firstName')      // true
 * isValidCypherIdentifier(') DELETE n //')  // false - injection attempt
 * isValidCypherIdentifier('MATCH')          // false - reserved keyword
 * ```
 */
export function isValidCypherIdentifier(identifier: string): boolean {
  if (identifier == null || typeof identifier !== 'string') return false;
  if (identifier.trim().length === 0) return false;
  if (identifier.length > MAX_IDENTIFIER_LENGTH) return false;

  for (const pattern of CYPHER_DANGEROUS_PATTERNS) {
    if (pattern.test(identifier)) return false;
  }
  return true;
}

/**
 * Escapes a Cypher identifier using backticks.
 *
 * If the identifier matches the safe pattern (alphanumeric + underscore),
 * it is returned as-is. Otherwise, backticks within the identifier are
 * doubled and the whole identifier is wrapped in backticks.
 *
 * @param identifier - The identifier to escape
 * @returns The escaped identifier
 *
 * @example
 * ```typescript
 * escapeCypherIdentifier('name')        // 'name'
 * escapeCypherIdentifier('first name')  // '`first name`'
 * escapeCypherIdentifier('has`tick')    // '`has``tick`'
 * ```
 */
export function escapeCypherIdentifier(identifier: string): string {
  if (SAFE_IDENTIFIER_PATTERN.test(identifier)) return identifier;
  const escaped = identifier.replace(/`/g, '``');
  return `\`${escaped}\``;
}

/**
 * Validates and escapes a Cypher identifier in one call.
 *
 * This is the primary function to use when sanitizing user input
 * for use in Cypher queries. It first validates the identifier
 * is safe, then escapes it appropriately.
 *
 * @param identifier - The identifier to sanitize
 * @param type - The type of identifier (for error messages)
 * @returns The sanitized identifier
 * @throws Error if the identifier contains dangerous patterns
 *
 * @example
 * ```typescript
 * sanitizeCypherIdentifier('Person', 'label')     // 'Person'
 * sanitizeCypherIdentifier('first name', 'property')  // '`first name`'
 * sanitizeCypherIdentifier(') DELETE n', 'label') // throws Error
 * ```
 */
export function sanitizeCypherIdentifier(
  identifier: string,
  type: 'label' | 'property' | 'relationship' = 'property'
): string {
  if (!isValidCypherIdentifier(identifier)) {
    throw new Error(
      `Invalid Cypher ${type}: "${identifier}". ` +
      `Cannot contain special characters, keywords, or comments.`
    );
  }
  return escapeCypherIdentifier(identifier);
}

/**
 * Validates and constrains a numeric LIMIT value.
 *
 * Ensures the limit is a valid non-negative integer and caps it
 * at a maximum value to prevent resource exhaustion.
 *
 * @param limit - The limit value to validate (number or string)
 * @param maxAllowed - Maximum allowed limit value (default: 10000)
 * @returns The validated and constrained limit value
 * @throws Error if the limit is not a valid non-negative integer
 *
 * @example
 * ```typescript
 * sanitizeCypherLimit(10)        // 10
 * sanitizeCypherLimit('50')      // 50
 * sanitizeCypherLimit(999999)    // 10000 (capped at max)
 * sanitizeCypherLimit(-5)        // throws Error
 * sanitizeCypherLimit('abc')     // throws Error
 * ```
 */
export function sanitizeCypherLimit(limit: unknown, maxAllowed = 10000): number {
  if (limit === undefined || limit === null) return maxAllowed;

  const num = typeof limit === 'number' ? limit : parseInt(String(limit), 10);

  if (isNaN(num) || !Number.isInteger(num)) {
    throw new Error(`Invalid LIMIT: ${limit}. Must be an integer.`);
  }
  if (num < 0) {
    throw new Error(`Invalid LIMIT: ${limit}. Must be non-negative.`);
  }
  return Math.min(num, maxAllowed);
}
