export const ROLES = { ADMIN: 'admin', VIEWER: 'viewer' };

export function getRole(session) {
  return session?.user?.app_metadata?.role === ROLES.VIEWER ? ROLES.VIEWER : ROLES.ADMIN;
}

export function isViewer(session) {
  return getRole(session) === ROLES.VIEWER;
}