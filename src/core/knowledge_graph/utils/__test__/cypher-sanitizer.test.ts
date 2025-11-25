import { describe, it, expect } from 'vitest';
import {
  isValidCypherIdentifier,
  escapeCypherIdentifier,
  sanitizeCypherIdentifier,
  sanitizeCypherLimit,
} from '../cypher-sanitizer.js';

describe('Cypher Sanitizer', () => {
  describe('isValidCypherIdentifier', () => {
    it('accepts valid simple identifiers', () => {
      expect(isValidCypherIdentifier('name')).toBe(true);
      expect(isValidCypherIdentifier('firstName')).toBe(true);
      expect(isValidCypherIdentifier('_private')).toBe(true);
      expect(isValidCypherIdentifier('node123')).toBe(true);
      expect(isValidCypherIdentifier('Person')).toBe(true);
      expect(isValidCypherIdentifier('KNOWS')).toBe(true);
    });

    it('rejects Cypher injection attempts with parens/brackets', () => {
      expect(isValidCypherIdentifier(') DELETE n //')).toBe(false);
      expect(isValidCypherIdentifier('name)')).toBe(false);
      expect(isValidCypherIdentifier('(name')).toBe(false);
      expect(isValidCypherIdentifier('name[0]')).toBe(false);
      expect(isValidCypherIdentifier('{name}')).toBe(false);
    });

    it('rejects Cypher injection attempts with comments', () => {
      expect(isValidCypherIdentifier('name--comment')).toBe(false);
      expect(isValidCypherIdentifier('name/*comment*/')).toBe(false);
      expect(isValidCypherIdentifier('/* */ name')).toBe(false);
    });

    it('rejects Cypher reserved keywords', () => {
      expect(isValidCypherIdentifier('MATCH')).toBe(false);
      expect(isValidCypherIdentifier('DELETE')).toBe(false);
      expect(isValidCypherIdentifier('CREATE')).toBe(false);
      expect(isValidCypherIdentifier('MERGE')).toBe(false);
      expect(isValidCypherIdentifier('SET')).toBe(false);
      expect(isValidCypherIdentifier('REMOVE')).toBe(false);
      expect(isValidCypherIdentifier('DETACH')).toBe(false);
      expect(isValidCypherIdentifier('RETURN')).toBe(false);
      expect(isValidCypherIdentifier('WHERE')).toBe(false);
      expect(isValidCypherIdentifier('WITH')).toBe(false);
      expect(isValidCypherIdentifier('CALL')).toBe(false);
      expect(isValidCypherIdentifier('YIELD')).toBe(false);
    });

    it('rejects statement terminators and newlines', () => {
      expect(isValidCypherIdentifier('name;')).toBe(false);
      expect(isValidCypherIdentifier('name\nDELETE')).toBe(false);
      expect(isValidCypherIdentifier('name\r\n')).toBe(false);
    });

    it('rejects empty/null/undefined', () => {
      expect(isValidCypherIdentifier('')).toBe(false);
      expect(isValidCypherIdentifier('   ')).toBe(false);
      expect(isValidCypherIdentifier(null as any)).toBe(false);
      expect(isValidCypherIdentifier(undefined as any)).toBe(false);
    });

    it('rejects extremely long identifiers', () => {
      const longIdentifier = 'a'.repeat(70000);
      expect(isValidCypherIdentifier(longIdentifier)).toBe(false);
    });
  });

  describe('escapeCypherIdentifier', () => {
    it('returns safe identifiers unchanged', () => {
      expect(escapeCypherIdentifier('name')).toBe('name');
      expect(escapeCypherIdentifier('firstName')).toBe('firstName');
      expect(escapeCypherIdentifier('_private')).toBe('_private');
      expect(escapeCypherIdentifier('Person')).toBe('Person');
    });

    it('wraps identifiers with spaces in backticks', () => {
      expect(escapeCypherIdentifier('first name')).toBe('`first name`');
      expect(escapeCypherIdentifier('some property')).toBe('`some property`');
    });

    it('escapes backticks by doubling them', () => {
      expect(escapeCypherIdentifier('has`tick')).toBe('`has``tick`');
      expect(escapeCypherIdentifier('multiple`back`ticks')).toBe('`multiple``back``ticks`');
    });

    it('wraps identifiers starting with numbers', () => {
      expect(escapeCypherIdentifier('123name')).toBe('`123name`');
    });
  });

  describe('sanitizeCypherIdentifier', () => {
    it('returns escaped identifier for valid input', () => {
      expect(sanitizeCypherIdentifier('name')).toBe('name');
      expect(sanitizeCypherIdentifier('first name')).toBe('`first name`');
      expect(sanitizeCypherIdentifier('Person', 'label')).toBe('Person');
    });

    it('throws on dangerous label input', () => {
      expect(() => sanitizeCypherIdentifier(') DELETE n', 'label'))
        .toThrow('Invalid Cypher label');
    });

    it('throws on dangerous property input', () => {
      expect(() => sanitizeCypherIdentifier('MATCH (n) RETURN n', 'property'))
        .toThrow('Invalid Cypher property');
    });

    it('throws on dangerous relationship input', () => {
      expect(() => sanitizeCypherIdentifier('KNOWS]->() DELETE', 'relationship'))
        .toThrow('Invalid Cypher relationship');
    });

    it('provides descriptive error messages', () => {
      expect(() => sanitizeCypherIdentifier('bad;input', 'label'))
        .toThrow('Cannot contain special characters, keywords, or comments');
    });
  });

  describe('sanitizeCypherLimit', () => {
    it('accepts valid integer limits', () => {
      expect(sanitizeCypherLimit(10)).toBe(10);
      expect(sanitizeCypherLimit(100)).toBe(100);
      expect(sanitizeCypherLimit(0)).toBe(0);
    });

    it('accepts string integer limits', () => {
      expect(sanitizeCypherLimit('50')).toBe(50);
      expect(sanitizeCypherLimit('100')).toBe(100);
    });

    it('caps at maximum allowed value', () => {
      expect(sanitizeCypherLimit(999999)).toBe(10000);
      expect(sanitizeCypherLimit(50000)).toBe(10000);
    });

    it('allows custom maximum', () => {
      expect(sanitizeCypherLimit(500, 100)).toBe(100);
      expect(sanitizeCypherLimit(50, 100)).toBe(50);
    });

    it('returns maxAllowed for undefined/null', () => {
      expect(sanitizeCypherLimit(undefined)).toBe(10000);
      expect(sanitizeCypherLimit(null)).toBe(10000);
      expect(sanitizeCypherLimit(undefined, 500)).toBe(500);
    });

    it('throws on non-integer values', () => {
      expect(() => sanitizeCypherLimit('abc')).toThrow('Invalid LIMIT');
      expect(() => sanitizeCypherLimit('12.5')).toThrow('Invalid LIMIT');
      expect(() => sanitizeCypherLimit(12.5)).toThrow('Invalid LIMIT');
      expect(() => sanitizeCypherLimit(NaN)).toThrow('Invalid LIMIT');
    });

    it('throws on negative values', () => {
      expect(() => sanitizeCypherLimit(-1)).toThrow('Must be non-negative');
      expect(() => sanitizeCypherLimit('-5')).toThrow('Must be non-negative');
    });

    it('prevents injection via limit parameter', () => {
      // These should throw rather than being interpreted as queries
      expect(() => sanitizeCypherLimit('10; DELETE n')).toThrow('Invalid LIMIT');
      expect(() => sanitizeCypherLimit('10 MATCH')).toThrow('Invalid LIMIT');
    });
  });

  describe('Security: Real-world injection prevention', () => {
    it('prevents label injection attack', () => {
      // Attack: Try to delete all nodes via label injection
      const maliciousLabel = 'Person`) DELETE (n) //';
      expect(() => sanitizeCypherIdentifier(maliciousLabel, 'label')).toThrow();
    });

    it('prevents relationship type injection attack', () => {
      // Attack: Try to modify data via relationship type
      const maliciousType = 'KNOWS]->(x) SET x.admin=true WITH x MATCH (y)-[r:';
      expect(() => sanitizeCypherIdentifier(maliciousType, 'relationship')).toThrow();
    });

    it('prevents property key injection attack', () => {
      // Attack: Try to access sensitive data via property key
      const maliciousKey = 'name} RETURN n.password, n.{';
      expect(() => sanitizeCypherIdentifier(maliciousKey, 'property')).toThrow();
    });

    it('prevents UNION-based injection', () => {
      const unionAttack = 'name UNION MATCH (m:Admin) RETURN m.password AS';
      expect(() => sanitizeCypherIdentifier(unionAttack, 'property')).toThrow();
    });
  });
});
