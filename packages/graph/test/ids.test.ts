import { describe, expect, it } from 'vitest';
import { nodeIdForLink } from '../src/ids';

describe('nodeIdForLink', () => {
  it('merges resolved narrators by narrator id', () => {
    expect(nodeIdForLink({ chainId: 1, position: 3, narratorId: 42 })).toBe('n:42');
    expect(nodeIdForLink({ chainId: 2, position: 5, narratorId: 42 })).toBe('n:42');
  });
  it('keeps unresolved mentions apart per chain and position', () => {
    expect(nodeIdForLink({ chainId: 1, position: 3, narratorId: null })).toBe('u:1:3');
  });
});
