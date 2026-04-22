export const ADMIN_ROLE_CLAIM = 'admin';

export const ADMIN_PERMISSIONS = [
  'PRODUCT_EDITOR',
  'QC_CHECK_1',
  'QC_CHECK_2',
  'OWNER',
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

export const isAdminPermission = (role: string): role is AdminPermission => {
  return (ADMIN_PERMISSIONS as readonly string[]).includes(role);
};

export const normalizeAdminRoles = (roles: unknown): AdminPermission[] => {
  if (!Array.isArray(roles)) return [];

  const validRoles = roles.filter((role): role is AdminPermission => {
    return typeof role === 'string' && isAdminPermission(role);
  });

  return Array.from(new Set(validRoles));
};

export const hasAdminPermission = (
  user: Record<string, any> | undefined,
  permission: AdminPermission
): boolean => {
  if (!user || user.role !== ADMIN_ROLE_CLAIM) return false;

  const roles = normalizeAdminRoles(user.adminRoles);
  return roles.includes('OWNER') || roles.includes(permission);
};

export const hasAnyAdminPermission = (
  user: Record<string, any> | undefined,
  permissions: AdminPermission[]
): boolean => {
  return permissions.some((permission) => hasAdminPermission(user, permission));
};
