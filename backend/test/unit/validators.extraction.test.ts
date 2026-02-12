/**
 * Unit tests: extraction schema validation.
 */

import { extractionSchema } from '../../src/validators';

describe('extraction schema', () => {
  const valid = {
    identity: { name: 'Jane', age: 30, location: 'NYC', languages: ['en'] },
    work: { job_title: 'Engineer', industry: 'Tech', company: 'Acme' },
    emotional_state: {
      overall_morale: 'medium',
      dominant_emotions: ['hopeful'],
      stressors: [],
      hardships: [],
      goals: ['ship product'],
    },
    relationships: { important_people: ['Mom'] },
    preferences: { values: ['honesty'], likes: ['coffee'], dislikes: [] },
    safety: { self_harm_risk: 'none' as const, notes: null },
    confidence: { identity: 0.9, work: 0.8, emotional_state: 0.7 },
    source_quotes: [{ field: 'name', quote: 'Jane' }],
  };

  it('accepts valid extraction', () => {
    expect(extractionSchema.parse(valid)).toEqual(valid);
  });

  it('accepts null name and age', () => {
    const withNulls = { ...valid, identity: { ...valid.identity, name: null, age: null } };
    expect(extractionSchema.parse(withNulls).identity.name).toBeNull();
    expect(extractionSchema.parse(withNulls).identity.age).toBeNull();
  });

  it('accepts morale low | medium | high', () => {
    for (const morale of ['low', 'medium', 'high']) {
      const o = { ...valid, emotional_state: { ...valid.emotional_state, overall_morale: morale } };
      expect(extractionSchema.parse(o).emotional_state.overall_morale).toBe(morale);
    }
  });

  it('accepts self_harm_risk none | possible | imminent', () => {
    for (const risk of ['none', 'possible', 'imminent']) {
      const o = { ...valid, safety: { ...valid.safety, self_harm_risk: risk } };
      expect(extractionSchema.parse(o).safety.self_harm_risk).toBe(risk);
    }
  });

  it('rejects invalid overall_morale', () => {
    const bad = { ...valid, emotional_state: { ...valid.emotional_state, overall_morale: 'bad' } };
    expect(() => extractionSchema.parse(bad)).toThrow();
  });

  it('rejects invalid self_harm_risk', () => {
    const bad = { ...valid, safety: { ...valid.safety, self_harm_risk: 'high' } };
    expect(() => extractionSchema.parse(bad)).toThrow();
  });

  it('rejects missing required fields', () => {
    const { safety, ...withoutSafety } = valid;
    expect(() => extractionSchema.parse(withoutSafety)).toThrow();
  });
});
