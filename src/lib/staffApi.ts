import { supabase } from './supabase';
import type { Staff, UserRole } from '../types/db';

const TIMEOUT_MS = 10_000;

export type StaffResult<T> = { ok: true; data: T } | { ok: false; code: string; message: string };

// Server error codes raised by the staff_* RPCs, in plain English.
const MESSAGES: Record<string, string> = {
  not_admin: 'Admin PIN not accepted.',
  weak_admin_pin: 'An admin PIN cannot be 0000. Choose another.',
  last_admin: 'This is the last active admin. Add or activate another admin first.',
  invalid_pin: 'PIN must be exactly 4 digits.',
  invalid_name: 'Enter a name.',
  invalid_role: 'Pick a role.',
  user_not_found: 'That person no longer exists. Refresh the list.',
};

export function staffErrorMessage(code: string): string {
  return MESSAGES[code] ?? "Couldn't reach the server. Check the connection and try again.";
}

async function call<T>(fn: string, args: Record<string, unknown>): Promise<StaffResult<T>> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const { data, error } = await supabase.rpc(fn, args).abortSignal(ctrl.signal);
    if (error) {
      // The RPCs raise bare codes ('not_admin', 'last_admin', ...) as the message.
      const code = error.message.trim();
      return { ok: false, code, message: staffErrorMessage(code) };
    }
    return { ok: true, data: data as T };
  } catch {
    return { ok: false, code: 'network', message: staffErrorMessage('network') };
  } finally {
    clearTimeout(timer);
  }
}

export const staffList = (adminId: string, adminPin: string) =>
  call<Staff[]>('staff_list', { p_admin_id: adminId, p_admin_pin: adminPin });

export const staffCreate = (
  adminId: string,
  adminPin: string,
  name: string,
  role: UserRole,
  pin: string,
) =>
  call<string>('staff_create', {
    p_admin_id: adminId,
    p_admin_pin: adminPin,
    p_name: name,
    p_role: role,
    p_pin: pin,
  });

export const staffUpdate = (
  adminId: string,
  adminPin: string,
  userId: string,
  name: string,
  role: UserRole,
  isActive: boolean,
) =>
  call<null>('staff_update', {
    p_admin_id: adminId,
    p_admin_pin: adminPin,
    p_user_id: userId,
    p_name: name,
    p_role: role,
    p_is_active: isActive,
  });

export const staffSetPin = (adminId: string, adminPin: string, userId: string, newPin: string) =>
  call<null>('staff_set_pin', {
    p_admin_id: adminId,
    p_admin_pin: adminPin,
    p_user_id: userId,
    p_new_pin: newPin,
  });
