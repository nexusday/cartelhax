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
  return role.toString().trim().toLowerCase();
}

function normalizeRoles(input) {
  if (!input) return [];
  if (Array.isArray(input)) {
    return Array.from(
      new Set(
        input
          .map((r) => normalizeRole(r))
          .filter(Boolean)
      )
    );
  }
  return [normalizeRole(input)];
}

function roleRank(role) {
  const normalized = normalizeRole(role);
  return ROLE_ORDER.includes(normalized) ? ROLE_ORDER.indexOf(normalized) : -1;
}

function canAccess(userRole, minRole) {
  const userRoles = normalizeRoles(userRole);
  const target = normalizeRole(minRole);
  const targetRank = roleRank(target);
  if (targetRank !== -1) {
    return userRoles.some((r) => {
      const rank = roleRank(r);
      return rank !== -1 && rank >= targetRank;
    });
  }
  return userRoles.includes(target);
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
  normalizeRoles,
};
