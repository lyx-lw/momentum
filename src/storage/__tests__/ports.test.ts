import { describe, expect, it } from 'vitest';
import {
  hasStorageCapability,
  LOCAL_STORAGE_CAPABILITIES,
  SUPABASE_STORAGE_CAPABILITIES,
  type StorageCapabilityProvider,
} from '../ports';

describe('storage capabilities', () => {
  it('returns explicit local capabilities when provided', () => {
    const storage: StorageCapabilityProvider = {
      kind: 'local',
      capabilities: LOCAL_STORAGE_CAPABILITIES,
    };

    expect(hasStorageCapability(storage, 'auth')).toBe(false);
    expect(hasStorageCapability(storage, 'betting')).toBe(false);
    expect(hasStorageCapability(storage, 'checkin')).toBe(true);
    expect(hasStorageCapability(storage, 'cloudSync')).toBe(false);
  });

  it('returns explicit supabase capabilities when provided', () => {
    const storage: StorageCapabilityProvider = {
      kind: 'supabase',
      capabilities: SUPABASE_STORAGE_CAPABILITIES,
    };

    expect(hasStorageCapability(storage, 'auth')).toBe(true);
    expect(hasStorageCapability(storage, 'betting')).toBe(true);
    expect(hasStorageCapability(storage, 'checkin')).toBe(true);
    expect(hasStorageCapability(storage, 'cloudSync')).toBe(true);
  });

  it('falls back to storage kind for legacy storages without capabilities', () => {
    expect(hasStorageCapability({ kind: 'local' }, 'auth')).toBe(false);
    expect(hasStorageCapability({ kind: 'local' }, 'cloudSync')).toBe(false);
    expect(hasStorageCapability({ kind: 'supabase' }, 'auth')).toBe(true);
    expect(hasStorageCapability({ kind: 'supabase' }, 'checkin')).toBe(true);
  });
});
