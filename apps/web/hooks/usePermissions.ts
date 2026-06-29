'use client';
import { useCallback } from 'react';
import { can, type Resource } from '@/lib/permissions';
import type { UserRole } from '@/lib/supabase';

export function usePermissions(role: UserRole | null) {
  const canI = useCallback(
    (resource: Resource, action: string): boolean => {
      if (!role) return false;
      return can(role, resource, action);
    },
    [role]
  );
  return { canI };
}
