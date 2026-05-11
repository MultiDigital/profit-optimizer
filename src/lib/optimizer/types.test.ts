import { describe, it, expect } from 'vitest';
import {
  GENDERS,
  GENDER_LABELS,
  CONTRACT_TYPES,
  CONTRACT_TYPE_LABELS,
  LIVELLI,
  LIVELLO_LABELS,
} from './types';

describe('identity field enums are exhaustive', () => {
  it('every Gender has a label', () => {
    for (const g of GENDERS) expect(GENDER_LABELS[g]).toBeDefined();
    expect(Object.keys(GENDER_LABELS)).toHaveLength(GENDERS.length);
  });

  it('every ContractType has a label', () => {
    for (const c of CONTRACT_TYPES) expect(CONTRACT_TYPE_LABELS[c]).toBeDefined();
    expect(Object.keys(CONTRACT_TYPE_LABELS)).toHaveLength(CONTRACT_TYPES.length);
  });

  it('every Livello has a label', () => {
    for (const l of LIVELLI) expect(LIVELLO_LABELS[l]).toBeDefined();
    expect(Object.keys(LIVELLO_LABELS)).toHaveLength(LIVELLI.length);
  });
});
