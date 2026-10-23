export const formatRoleLabel = (role) => (
  role ? role.replace(/_/g, ' ').replace(/\b\w/g, character => character.toUpperCase()) : ''
);

export const formatPositionLabel = (position) => {
  if (!position) return '';
  if (position === 'head_department') return 'Department Chair';
  return formatRoleLabel(position);
};

export const formatRoleAndPosition = (user, fallbackRole = '') => (
  [...new Set([
    formatRoleLabel(user?.role) || fallbackRole,
    formatPositionLabel(user?.position),
  ].filter(Boolean))]
    .join(' · ')
);
