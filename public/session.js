const SESSION_COOKIE = "cartelhax_session";
const ROLE_ORDER = ["miembro", "premium", "vip", "diamantes"];
const ADMIN_MIN_ROLE = "diamantes";

function setSessionCookie(data) {
  try {
    const normalized = {
      username: data.username,
      email: data.email,
      role: normalizeRole(data.role),
      userKey: data.userKey ?? null,
    };
    const encoded = btoa(JSON.stringify(normalized));
    document.cookie = `${SESSION_COOKIE}=${encoded}; path=/; max-age=${60 * 60 * 24}; SameSite=Lax`;
  } catch (error) {
    console.error("setSessionCookie error", error);
  }
}

function getSessionCookie() {
  const cookies = document.cookie.split(";").map((item) => item.trim());
  for (const cookie of cookies) {
    if (!cookie.startsWith(`${SESSION_COOKIE}=`)) continue;
    const value = cookie.substring(SESSION_COOKIE.length + 1);
    try {
      const parsed = JSON.parse(atob(value));
      parsed.role = normalizeRole(parsed.role);
      parsed.userKey = parsed.userKey ?? null;
      return parsed;
    } catch (error) {
      console.error("getSessionCookie error", error);
      return null;
    }
  }
  return null;
}

function clearSessionCookie() {
  document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}

function normalizeRole(role) {
  if (!role) return ROLE_ORDER[0];
  const normalized = role.toString().trim().toLowerCase();
  return ROLE_ORDER.includes(normalized) ? normalized : ROLE_ORDER[0];
}

function roleRank(role) {
  return ROLE_ORDER.indexOf(normalizeRole(role));
}

function canAccess(userRole, minRole) {
  return roleRank(userRole) >= roleRank(minRole);
}

export {
  SESSION_COOKIE,
  ROLE_ORDER,
  ADMIN_MIN_ROLE,
  setSessionCookie,
  getSessionCookie,
  clearSessionCookie,
  canAccess,
  roleRank,
  normalizeRole,
};
