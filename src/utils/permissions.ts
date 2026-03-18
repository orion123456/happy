import type { Gift } from '../types/gift';
import type { Role } from '../types/auth';

export function isAdmin(role: Role | null): role is 'administrator' {
  return role === 'administrator';
}

export function canCreateGift(role: Role | null): boolean {
  return isAdmin(role);
}

export function canEditGift(role: Role | null): boolean {
  return isAdmin(role);
}

export function canDeleteGift(role: Role | null): boolean {
  return isAdmin(role);
}

export function canReserveGift(role: Role | null, gift: Gift): boolean {
  if (!role) {
    return false;
  }

  if (gift.is_reserved) {
    return false;
  }

  return role === 'administrator' || role === 'user';
}

export function canUnreserveGift(role: Role | null): boolean {
  return isAdmin(role);
}
