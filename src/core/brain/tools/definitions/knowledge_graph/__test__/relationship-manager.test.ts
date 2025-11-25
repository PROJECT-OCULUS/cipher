import { describe, it, expect } from 'vitest';

/**
 * Test suite for FALLBACK_PATTERNS in relationship-manager.ts
 *
 * These tests verify the regex patterns used for entity extraction
 * when the LLM fails to parse instructions.
 *
 * Pattern Priority:
 * 1) Quoted entities (explicit boundaries)
 * 2) Multi-word unquoted (non-greedy with punctuation terminators)
 * 3) Single-word fallback (backwards compatibility)
 */

// Re-define patterns here for direct testing
// This mirrors the FALLBACK_PATTERNS in relationship-manager.ts
type RelationshipOperation =
	| 'replace_entity'
	| 'update_relationship'
	| 'merge_entities'
	| 'delete_relationships'
	| 'bulk_update'
	| 'conditional_update';

interface PatternDefinition {
	pattern: RegExp;
	type: RelationshipOperation;
	extract: (match: RegExpMatchArray) => {
		entities?: { source?: string; target?: string };
		relationships?: { property?: string; value?: string };
	};
}

const FALLBACK_PATTERNS: PatternDefinition[] = [
	// === Priority 1: Quoted entities (explicit boundaries) ===
	{
		pattern: /not\s+["']([^"']+)["']\s+but\s+["']([^"']+)["']/i,
		type: 'replace_entity',
		extract: (match) => ({
			entities: { source: match[1].trim(), target: match[2].trim() }
		})
	},
	{
		pattern: /replace\s+["']([^"']+)["']\s+with\s+["']([^"']+)["']/i,
		type: 'replace_entity',
		extract: (match) => ({
			entities: { source: match[1].trim(), target: match[2].trim() }
		})
	},
	{
		pattern: /["']([^"']+)["']\s+instead\s+of\s+["']([^"']+)["']/i,
		type: 'replace_entity',
		extract: (match) => ({
			entities: { source: match[2].trim(), target: match[1].trim() }
		})
	},
	{
		pattern: /(?:merge|combine)\s+["']([^"']+)["']\s+(?:and|with)\s+["']([^"']+)["']/i,
		type: 'merge_entities',
		extract: (match) => ({
			entities: { source: match[1].trim(), target: match[2].trim() }
		})
	},
	{
		pattern: /delete\s+(?:relationship|connection|link).*between\s+["']([^"']+)["']\s+and\s+["']([^"']+)["']/i,
		type: 'delete_relationships',
		extract: (match) => ({
			entities: { source: match[1].trim(), target: match[2].trim() }
		})
	},

	// === Priority 2: Multi-word with broader punctuation terminators ===
	{
		pattern: /not\s+(.+?)\s+but\s+(.+?)(?:\s*[,.;!?:]|$)/i,
		type: 'replace_entity',
		extract: (match) => ({
			entities: { source: match[1].trim(), target: match[2].trim() }
		})
	},
	{
		pattern: /replace\s+(.+?)\s+with\s+(.+?)(?:\s*[,.;!?:]|$)/i,
		type: 'replace_entity',
		extract: (match) => ({
			entities: { source: match[1].trim(), target: match[2].trim() }
		})
	},
	{
		pattern: /(?:merge|combine)\s+(.+?)\s+(?:and|with)\s+(.+?)(?:\s*[,.;!?:]|$)/i,
		type: 'merge_entities',
		extract: (match) => ({
			entities: { source: match[1].trim(), target: match[2].trim() }
		})
	},
	{
		pattern: /delete\s+(?:relationship|connection|link).*between\s+(.+?)\s+and\s+(.+?)(?:\s*[,.;!?:]|$)/i,
		type: 'delete_relationships',
		extract: (match) => ({
			entities: { source: match[1].trim(), target: match[2].trim() }
		})
	},
	{
		pattern: /(.+?)\s+instead\s+of\s+(.+?)(?:\s*[,.;!?:]|$)/i,
		type: 'replace_entity',
		extract: (match) => ({
			entities: { source: match[2].trim(), target: match[1].trim() }
		})
	},
	{
		pattern: /change\s+(.+?)\s+to\s+(.+?)(?:\s*[,.;!?:]|$)/i,
		type: 'replace_entity',
		extract: (match) => ({
			entities: { source: match[1].trim(), target: match[2].trim() }
		})
	},
	{
		pattern: /rename\s+(.+?)\s+to\s+(.+?)(?:\s*[,.;!?:]|$)/i,
		type: 'replace_entity',
		extract: (match) => ({
			entities: { source: match[1].trim(), target: match[2].trim() }
		})
	},

	// === Priority 3: Single-word fallback (backwards compatibility) ===
	{
		pattern: /replace\s+(\S+)\s+with\s+(\S+)/i,
		type: 'replace_entity',
		extract: (match) => ({
			entities: { source: match[1], target: match[2] }
		})
	},
	{
		pattern: /not\s+(\S+)\s+but\s+(\S+)/i,
		type: 'replace_entity',
		extract: (match) => ({
			entities: { source: match[1], target: match[2] }
		})
	},
	{
		pattern: /(?:merge|combine)\s+(\S+)\s+(?:and|with)\s+(\S+)/i,
		type: 'merge_entities',
		extract: (match) => ({
			entities: { source: match[1], target: match[2] }
		})
	},
	{
		pattern: /delete\s+(?:relationship|connection|link).*between\s+(\S+)\s+and\s+(\S+)/i,
		type: 'delete_relationships',
		extract: (match) => ({
			entities: { source: match[1], target: match[2] }
		})
	},
	{
		pattern: /update\s+(\S+)(?:'s|'s)\s+(\S+)\s+to\s+(\S+)/i,
		type: 'update_relationship',
		extract: (match) => ({
			entities: { source: match[1] },
			relationships: { property: match[2], value: match[3] }
		})
	},
	{
		pattern: /(.+?)\s*(?:->|=>)\s*(.+?)(?:\s*[,.;!?:]|$)/i,
		type: 'replace_entity',
		extract: (match) => ({
			entities: { source: match[1].trim(), target: match[2].trim() }
		})
	}
];

/**
 * Helper function to match an instruction against all patterns
 * Returns first match (respecting priority order)
 */
function matchPattern(instruction: string): {
	type: RelationshipOperation;
	entities?: { source?: string; target?: string };
	relationships?: { property?: string; value?: string };
} | null {
	for (const { pattern, type, extract } of FALLBACK_PATTERNS) {
		const match = instruction.match(pattern);
		if (match) {
			const params = extract(match);
			return { type, ...params };
		}
	}
	return null;
}

describe('FALLBACK_PATTERNS - Entity Extraction', () => {
	describe('Priority 1: Quoted Entities', () => {
		it('matches not "X" but "Y" pattern', () => {
			const result = matchPattern('not "Cotman Housing" but "Places for People"');
			expect(result).not.toBeNull();
			expect(result?.type).toBe('replace_entity');
			expect(result?.entities?.source).toBe('Cotman Housing');
			expect(result?.entities?.target).toBe('Places for People');
		});

		it('matches replace "X" with "Y" pattern', () => {
			const result = matchPattern('replace "Old Corp Inc" with "New Corp Ltd"');
			expect(result).not.toBeNull();
			expect(result?.type).toBe('replace_entity');
			expect(result?.entities?.source).toBe('Old Corp Inc');
			expect(result?.entities?.target).toBe('New Corp Ltd');
		});

		it('matches "X" instead of "Y" pattern (reversed)', () => {
			const result = matchPattern('"Acme Industries" instead of "Beta Corp"');
			expect(result).not.toBeNull();
			expect(result?.type).toBe('replace_entity');
			expect(result?.entities?.source).toBe('Beta Corp');
			expect(result?.entities?.target).toBe('Acme Industries');
		});

		it('matches merge "X" and "Y" pattern', () => {
			const result = matchPattern('merge "Entity A" and "Entity B"');
			expect(result).not.toBeNull();
			expect(result?.type).toBe('merge_entities');
			expect(result?.entities?.source).toBe('Entity A');
			expect(result?.entities?.target).toBe('Entity B');
		});

		it('matches combine "X" with "Y" pattern', () => {
			const result = matchPattern('combine "First Co" with "Second Co"');
			expect(result).not.toBeNull();
			expect(result?.type).toBe('merge_entities');
			expect(result?.entities?.source).toBe('First Co');
			expect(result?.entities?.target).toBe('Second Co');
		});

		it('matches delete relationship between "X" and "Y" pattern', () => {
			const result = matchPattern('delete relationship between "Org A" and "Org B"');
			expect(result).not.toBeNull();
			expect(result?.type).toBe('delete_relationships');
			expect(result?.entities?.source).toBe('Org A');
			expect(result?.entities?.target).toBe('Org B');
		});

		it('handles single quotes', () => {
			const result = matchPattern("not 'Cotman Housing' but 'Places for People'");
			expect(result).not.toBeNull();
			expect(result?.entities?.source).toBe('Cotman Housing');
			expect(result?.entities?.target).toBe('Places for People');
		});
	});

	describe('Priority 2: Multi-word Unquoted', () => {
		it('matches not X but Y with period terminator', () => {
			const result = matchPattern('not Cotman Housing but Places for People.');
			expect(result).not.toBeNull();
			expect(result?.type).toBe('replace_entity');
			expect(result?.entities?.source).toBe('Cotman Housing');
			expect(result?.entities?.target).toBe('Places for People');
		});

		it('matches replace X with Y with semicolon terminator', () => {
			const result = matchPattern('replace Old Company with New Company;');
			expect(result).not.toBeNull();
			expect(result?.type).toBe('replace_entity');
			expect(result?.entities?.source).toBe('Old Company');
			expect(result?.entities?.target).toBe('New Company');
		});

		it('matches not X but Y with exclamation terminator', () => {
			const result = matchPattern('not Alpha Beta but Gamma Delta!');
			expect(result).not.toBeNull();
			expect(result?.entities?.source).toBe('Alpha Beta');
			expect(result?.entities?.target).toBe('Gamma Delta');
		});

		it('matches merge X and Y with period terminator', () => {
			const result = matchPattern('merge First Entity and Second Entity.');
			expect(result).not.toBeNull();
			expect(result?.type).toBe('merge_entities');
			expect(result?.entities?.source).toBe('First Entity');
			expect(result?.entities?.target).toBe('Second Entity');
		});

		it('matches delete connection between X and Y', () => {
			const result = matchPattern('delete connection between Alpha Corp and Beta Inc.');
			expect(result).not.toBeNull();
			expect(result?.type).toBe('delete_relationships');
			expect(result?.entities?.source).toBe('Alpha Corp');
			expect(result?.entities?.target).toBe('Beta Inc');
		});

		it('matches X instead of Y (unquoted)', () => {
			const result = matchPattern('New Company instead of Old Company.');
			expect(result).not.toBeNull();
			expect(result?.type).toBe('replace_entity');
			expect(result?.entities?.source).toBe('Old Company');
			expect(result?.entities?.target).toBe('New Company');
		});

		it('matches change X to Y', () => {
			const result = matchPattern('change Old Name to New Name.');
			expect(result).not.toBeNull();
			expect(result?.type).toBe('replace_entity');
			expect(result?.entities?.source).toBe('Old Name');
			expect(result?.entities?.target).toBe('New Name');
		});

		it('matches rename X to Y', () => {
			const result = matchPattern('rename Project Alpha to Project Beta.');
			expect(result).not.toBeNull();
			expect(result?.type).toBe('replace_entity');
			expect(result?.entities?.source).toBe('Project Alpha');
			expect(result?.entities?.target).toBe('Project Beta');
		});

		it('matches at end of string (no terminator)', () => {
			const result = matchPattern('not Cotman Housing but Places for People');
			expect(result).not.toBeNull();
			expect(result?.entities?.source).toBe('Cotman Housing');
			expect(result?.entities?.target).toBe('Places for People');
		});
	});

	describe('Priority 3: Single-word Fallback', () => {
		it('matches not X but Y single words', () => {
			const result = matchPattern('not John but Jane');
			expect(result).not.toBeNull();
			expect(result?.type).toBe('replace_entity');
			expect(result?.entities?.source).toBe('John');
			expect(result?.entities?.target).toBe('Jane');
		});

		it('matches replace X with Y single words', () => {
			const result = matchPattern('replace foo with bar');
			expect(result).not.toBeNull();
			expect(result?.type).toBe('replace_entity');
			expect(result?.entities?.source).toBe('foo');
			expect(result?.entities?.target).toBe('bar');
		});

		it('matches merge X and Y single words', () => {
			const result = matchPattern('merge alpha and beta');
			expect(result).not.toBeNull();
			expect(result?.type).toBe('merge_entities');
			expect(result?.entities?.source).toBe('alpha');
			expect(result?.entities?.target).toBe('beta');
		});

		it('matches delete relationship between X and Y single words', () => {
			const result = matchPattern('delete relationship between X and Y');
			expect(result).not.toBeNull();
			expect(result?.type).toBe('delete_relationships');
			expect(result?.entities?.source).toBe('X');
			expect(result?.entities?.target).toBe('Y');
		});

		it("matches update X's Y to Z", () => {
			const result = matchPattern("update John's role to admin");
			expect(result).not.toBeNull();
			expect(result?.type).toBe('update_relationship');
			expect(result?.entities?.source).toBe('John');
			expect(result?.relationships?.property).toBe('role');
			expect(result?.relationships?.value).toBe('admin');
		});

		it('matches X -> Y arrow notation', () => {
			const result = matchPattern('OldEntity -> NewEntity');
			expect(result).not.toBeNull();
			expect(result?.type).toBe('replace_entity');
			expect(result?.entities?.source).toBe('OldEntity');
			expect(result?.entities?.target).toBe('NewEntity');
		});

		it('matches X => Y arrow notation', () => {
			const result = matchPattern('Source => Target');
			expect(result).not.toBeNull();
			expect(result?.type).toBe('replace_entity');
			expect(result?.entities?.source).toBe('Source');
			expect(result?.entities?.target).toBe('Target');
		});
	});

	describe('Edge Cases', () => {
		it('handles repeated keywords - captures to punctuation or end', () => {
			// Without a punctuation terminator, multi-word pattern captures to end
			const result = matchPattern('not A but B but C');
			expect(result).not.toBeNull();
			expect(result?.entities?.source).toBe('A');
			// Non-greedy (.+?) captures minimally but still needs terminator or EOL
			expect(result?.entities?.target).toBe('B but C');
		});

		it('handles repeated "with" keyword - captures to terminator', () => {
			const result = matchPattern('replace X with Y with Z.');
			expect(result).not.toBeNull();
			expect(result?.entities?.source).toBe('X');
			// Captures to the period terminator, which is after "Z"
			expect(result?.entities?.target).toBe('Y with Z');
		});

		it('handles repeated keywords WITH terminator correctly', () => {
			// With a terminator after first entity pair, stops correctly
			const result = matchPattern('not A but B, and then C');
			expect(result).not.toBeNull();
			expect(result?.entities?.source).toBe('A');
			expect(result?.entities?.target).toBe('B');
		});

		it('handles all punctuation terminators', () => {
			const terminators = ['.', ',', ';', '!', '?', ':'];
			terminators.forEach(term => {
				const result = matchPattern(`replace X with Y${term}`);
				expect(result).not.toBeNull();
				expect(result?.entities?.target).toBe('Y');
			});
		});

		it('handles mixed case keywords', () => {
			const result = matchPattern('NOT foo BUT bar');
			expect(result).not.toBeNull();
			expect(result?.entities?.source).toBe('foo');
			expect(result?.entities?.target).toBe('bar');
		});

		it('handles REPLACE keyword in uppercase', () => {
			const result = matchPattern('REPLACE old WITH new');
			expect(result).not.toBeNull();
			expect(result?.entities?.source).toBe('old');
			expect(result?.entities?.target).toBe('new');
		});

		it('trims whitespace from entities', () => {
			const result = matchPattern('not "  spaced entity  " but "  another  "');
			expect(result).not.toBeNull();
			expect(result?.entities?.source).toBe('spaced entity');
			expect(result?.entities?.target).toBe('another');
		});

		it('returns null for non-matching input', () => {
			const result = matchPattern('this is just random text');
			expect(result).toBeNull();
		});

		it('returns null for empty string', () => {
			const result = matchPattern('');
			expect(result).toBeNull();
		});
	});

	describe('Pattern Priority Order', () => {
		it('quoted patterns take precedence when BOTH entities are quoted', () => {
			// Quoted pattern requires BOTH entities to be quoted
			const result = matchPattern('not "Exact Quote" but "Another Quote"');
			expect(result).not.toBeNull();
			// Quoted pattern matches and extracts without quotes
			expect(result?.entities?.source).toBe('Exact Quote');
			expect(result?.entities?.target).toBe('Another Quote');
		});

		it('falls to multi-word when only one entity is quoted', () => {
			// Only first entity is quoted, so quoted pattern doesn't match
			const result = matchPattern('not "Exact Quote" but also words.');
			expect(result).not.toBeNull();
			// Multi-word pattern matches, captures quotes as part of entity
			expect(result?.entities?.source).toBe('"Exact Quote"');
			expect(result?.entities?.target).toBe('also words');
		});

		it('multi-word patterns take precedence over single-word for multi-word input', () => {
			const result = matchPattern('not Alpha Beta but Gamma Delta.');
			expect(result).not.toBeNull();
			// Should capture full "Alpha Beta", not just "Alpha"
			expect(result?.entities?.source).toBe('Alpha Beta');
			expect(result?.entities?.target).toBe('Gamma Delta');
		});

		it('single-word fallback works when no terminator present for single words', () => {
			const result = matchPattern('not foo but bar');
			expect(result).not.toBeNull();
			expect(result?.entities?.source).toBe('foo');
			expect(result?.entities?.target).toBe('bar');
		});
	});

	describe('Operation Type Detection', () => {
		const operationTests = [
			{ input: 'not X but Y', expectedType: 'replace_entity' },
			{ input: 'replace X with Y', expectedType: 'replace_entity' },
			{ input: 'merge X and Y', expectedType: 'merge_entities' },
			{ input: 'combine X with Y', expectedType: 'merge_entities' },
			{ input: 'delete relationship between X and Y', expectedType: 'delete_relationships' },
			{ input: "update X's role to admin", expectedType: 'update_relationship' },
			{ input: 'change X to Y.', expectedType: 'replace_entity' },
			{ input: 'rename X to Y.', expectedType: 'replace_entity' },
			{ input: 'X -> Y', expectedType: 'replace_entity' },
			{ input: 'X => Y', expectedType: 'replace_entity' },
			{ input: '"A" instead of "B"', expectedType: 'replace_entity' },
		];

		operationTests.forEach(({ input, expectedType }) => {
			it(`"${input}" → ${expectedType}`, () => {
				const result = matchPattern(input);
				expect(result).not.toBeNull();
				expect(result?.type).toBe(expectedType);
			});
		});
	});
});
