// src/domain/auth/auth.rules.test.ts
import { describe, it, expect } from 'vitest';
import { hasPermission } from './auth.rules';
import { ROLES } from '@/constants/roles';

describe('RBAC Authorization Rules', () => {
  it('Admin can bypass standard custody rules for auditing', () => {
    const result = hasPermission(ROLES.ADMIN, 'view_all_logs');
    expect(result).toBe(true);
  });

  it('Liaison Officer cannot seal a document they do not hold', () => {
    // Simulating checking custody before showing the "Seal" button
    const result = hasPermission(ROLES.PHO_STAFF, 'seal_timeline', { hasCustody: false });
    expect(result).toBe(false);
  });
});