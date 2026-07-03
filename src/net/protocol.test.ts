import { describe, expect, it } from 'vitest';
import { SCHEMA_VERSION } from '../engine/types';
import { isCompatibleSnapshot, makeMessage, shouldApplySnapshot } from './protocol';

describe('protocole réseau (TECH_ARCHITECTURE §6.2)', () => {
  it("makeMessage construit l'enveloppe complète", () => {
    const msg = makeMessage('ACTION', 'sender-1', { t: 'start_run' });
    expect(msg.type).toBe('ACTION');
    expect(msg.senderId).toBe('sender-1');
    expect(typeof msg.ts).toBe('number');
    expect(msg.payload).toEqual({ t: 'start_run' });
  });

  it('shouldApplySnapshot : seuls les snapshots plus récents (stateId monotone) passent', () => {
    expect(shouldApplySnapshot(-1, 0)).toBe(true); // premier snapshot
    expect(shouldApplySnapshot(5, 6)).toBe(true);
    expect(shouldApplySnapshot(5, 5)).toBe(false); // doublon
    expect(shouldApplySnapshot(5, 3)).toBe(false); // en retard
  });

  it('isCompatibleSnapshot : garde de version (invariant C1 de BUILD_PLAN_V2)', () => {
    expect(isCompatibleSnapshot({ schemaVersion: SCHEMA_VERSION })).toBe(true);
    expect(isCompatibleSnapshot({ schemaVersion: 3 })).toBe(false); // sauvegardes/snapshots v3
    expect(isCompatibleSnapshot({ schemaVersion: SCHEMA_VERSION + 1 })).toBe(false);
    expect(isCompatibleSnapshot({})).toBe(false);
    expect(isCompatibleSnapshot(null)).toBe(false);
  });
});
