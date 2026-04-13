export const ROLES = ["Admin", "Supervisor", "Accountant", "User", "Operator"];

export const ROLE_OPTIONS = [
  { value: "Admin", label: "Administrator" },
  { value: "Supervisor", label: "Supervisor" },
  { value: "Accountant", label: "Accountant" },
  { value: "User", label: "User" },
  { value: "Operator", label: "Operator" },
];

const ALL_ROLES = [...ROLES];

export const MODULE_PERMISSIONS = {
  dashboard: { view: ALL_ROLES, manage: [] },
  users: { view: ["Admin"], manage: ["Admin"] },
  models: { view: ["Admin", "Supervisor", "User", "Operator"], manage: ["Admin", "User", "Operator"] },
  serials: { view: ["Admin", "Supervisor", "User", "Operator"], manage: ["Admin", "User", "Operator"] },
  orderTracking: { view: ["Admin", "Supervisor", "User", "Operator"], manage: ["Admin", "User", "Operator"] },
  billing: { view: ["Admin", "Accountant"], manage: ["Admin", "Accountant"] },
  dispatch: { view: ["Admin", "Supervisor", "User", "Operator"], manage: ["Admin", "User", "Operator"] },
  installations: { view: ["Admin", "Supervisor", "User", "Operator"], manage: ["Admin", "User", "Operator"] },
  returns: { view: ["Admin", "Supervisor", "User", "Operator"], manage: ["Admin", "User", "Operator"] },
  damaged: { view: ["Admin", "Supervisor", "User", "Operator"], manage: ["Admin", "User", "Operator"] },
  reports: { view: ["Admin", "Supervisor", "Accountant"], manage: ["Admin", "Accountant"] },
};

export function normalizeRole(role) {
  const matched = ROLES.find(
    (item) => item.toLowerCase() === String(role || "User").toLowerCase()
  );
  return matched || "User";
}

export function canViewModule(role, moduleId) {
  const permission = MODULE_PERMISSIONS[moduleId];
  if (!permission) return false;
  return permission.view.includes(normalizeRole(role));
}

export function canManageModule(role, moduleId) {
  const permission = MODULE_PERMISSIONS[moduleId];
  if (!permission) return false;
  return permission.manage.includes(normalizeRole(role));
}

export function getDefaultTabForRole(role) {
  return normalizeRole(role) === "Accountant" ? "billing" : "dashboard";
}

export function getFirstAccessibleTab(navItems, role) {
  return navItems.find((item) => canViewModule(role, item.id))?.id || getDefaultTabForRole(role);
}

