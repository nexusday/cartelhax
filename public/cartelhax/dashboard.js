import { db, ref, onValue } from "../base.js";
import {
  getSessionCookie,
  clearSessionCookie,
  setSessionCookie,
  ADMIN_MIN_ROLE,
  roleRank,
  ROLE_ORDER,
  normalizeRole,
} from "../session.js";

let session = getSessionCookie();
if (!session) {
  window.location.replace("../index.html");
  throw new Error("Sesión no encontrada");
}

const welcomeCopy = document.getElementById("welcome-copy");
const linksSummary = document.getElementById("links-summary");
const linksStatus = document.getElementById("links-status");
const linksGrid = document.getElementById("links-grid");
const logoutBtn = document.getElementById("btn-logout");

function buildUserKey(username) {
  return username.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

const userKey = session.userKey ?? buildUserKey(session.username);
if (!session.userKey) {
  session = { ...session, userKey };
  setSessionCookie(session);
}

let allLinks = [];

renderSessionInfo();

logoutBtn?.addEventListener("click", () => {
  clearSessionCookie();
  window.location.replace("../index.html");
});

const userRef = ref(db, `users/${userKey}`);
onValue(
  userRef,
  (snapshot) => {
    if (!snapshot.exists()) {
      clearSessionCookie();
      window.location.replace("../index.html");
      return;
    }

    const data = snapshot.val();
    session = {
      username: data.username ?? session.username,
      email: data.email ?? session.email,
      role: normalizeRole(data.role),
      userKey,
    };
    setSessionCookie(session);
    renderSessionInfo();
    refreshLinks();
  },
  (error) => {
    console.error("user listener", error);
  }
);

const linksRef = ref(db, "links");
onValue(
  linksRef,
  (snapshot) => {
    const data = snapshot.val() ?? {};
    allLinks = Object.entries(data).map(([id, value]) => ({
      id,
      name: value.name ?? "Sin nombre",
      url: value.url ?? "#",
      minRole: value.minRole ? normalizeRole(value.minRole) : ROLE_ORDER[0],
      createdAt: value.createdAt ?? 0,
    }));

    refreshLinks();
  },
  (error) => {
    console.error("links listener", error);
    linksStatus.textContent = "No pudimos cargar los enlaces.";
    linksStatus.classList.add("error");
  }
);

function renderSessionInfo() {
  const roleLabel = session.role ? session.role.toUpperCase() : "MIEMBRO";
  welcomeCopy.textContent = `Bienvenido, ${session.username} · ${roleLabel}`;
}

function refreshLinks() {
  const visibleLinks = allLinks.filter((entry) => {
    if (entry.minRole === ROLE_ORDER[0]) return true;
    return session.role === entry.minRole;
  });
  renderLinks(allLinks.length, visibleLinks);
}

function renderLinks(totalCount, visibleLinks) {
  linksStatus.textContent = "";
  linksStatus.classList.remove("error");

  if (totalCount === 0) {
    linksSummary.textContent = "No hay enlaces publicados aún.";
  } else {
    linksSummary.textContent = `Ves ${visibleLinks.length} de ${totalCount} enlaces disponibles.`;
  }

  linksGrid.innerHTML = "";

  if (visibleLinks.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Aún no tienes enlaces para tu rango. Si crees que es un error, contacta al administrador.";
    linksGrid.appendChild(empty);
    return;
  }

  visibleLinks
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
    .forEach((link) => {
      const card = document.createElement("article");
      card.className = "link-card";

      const header = document.createElement("header");
      const title = document.createElement("h3");
      title.textContent = link.name;
      const badge = document.createElement("span");
      badge.className = "role-badge";
      badge.textContent = `Rango mínimo: ${link.minRole.toUpperCase()}`;
      header.append(title, badge);

      const button = document.createElement("a");
      button.href = link.url;
      button.target = "_blank";
      button.rel = "noopener noreferrer";
      button.textContent = "Entrar";
      button.className = "link-button";

      card.append(header, button);
      linksGrid.appendChild(card);
    });
}
