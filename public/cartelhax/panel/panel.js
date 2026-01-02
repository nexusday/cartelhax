import { db, ref, onValue, update, set, remove } from "../../base.js";
import {
  getSessionCookie,
  clearSessionCookie,
  roleRank,
  ROLE_ORDER,
  ADMIN_MIN_ROLE,
  normalizeRole,
} from "../../session.js";

const session = getSessionCookie();
if (!session || roleRank(session.role) < roleRank(ADMIN_MIN_ROLE)) {
  window.location.replace("../../index.html");
  throw new Error("Acceso restringido");
}

const adminSummary = document.getElementById("admin-summary");
const usersStatus = document.getElementById("users-status");
const usersTable = document.getElementById("users-table");
const linksForm = document.getElementById("link-form");
const linksFormStatus = document.getElementById("links-form-status");
const linksList = document.getElementById("links-list");
const linksCount = document.getElementById("links-count");
const logoutBtn = document.getElementById("btn-logout");
const backBtn = document.getElementById("btn-back");
const minRoleSelect = linksForm?.querySelector("select[name='minRole']");

adminSummary.textContent = `Conectado como ${session.username} · ${session.role.toUpperCase()}`;
ROLE_ORDER.forEach((role) => {
  const option = document.createElement("option");
  option.value = role;
  option.textContent = role.toUpperCase();
  minRoleSelect?.appendChild(option);
});

logoutBtn?.addEventListener("click", () => {
  clearSessionCookie();
  window.location.replace("../../index.html");
});

backBtn?.addEventListener("click", () => {
  window.location.replace("../");
});


const usersRef = ref(db, "users");
onValue(
  usersRef,
  (snapshot) => {
    usersStatus.textContent = "";
    usersStatus.classList.remove("error");
    const data = snapshot.val() ?? {};
    const entries = Object.entries(data).map(([key, value]) => ({
      key,
      username: value.username,
      email: value.email,
      role: normalizeRole(value.role),
      createdAt: value.createdAt ?? 0,
    }));
    renderUsers(entries);
  },
  (error) => {
    console.error("users listener", error);
    usersStatus.textContent = "No se pudo cargar la lista de usuarios.";
    usersStatus.classList.add("error");
  }
);

function renderUsers(users) {
  usersTable.innerHTML = "";
  if (users.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 4;
    cell.textContent = "Sin usuarios registrados.";
    cell.style.color = "var(--muted)";
    row.appendChild(cell);
    usersTable.appendChild(row);
    return;
  }

  users
    .sort((a, b) => (a.username ?? "").localeCompare(b.username ?? ""))
    .forEach((user) => {
      const row = document.createElement("tr");

      const userCell = document.createElement("td");
      userCell.textContent = user.username;

      const emailCell = document.createElement("td");
      emailCell.textContent = user.email;

      const roleCell = document.createElement("td");
      const roleSelect = document.createElement("select");
      ROLE_ORDER.forEach((role) => {
        const option = document.createElement("option");
        option.value = role;
        option.textContent = role.toUpperCase();
        if (role === user.role) option.selected = true;
        roleSelect.appendChild(option);
      });
      roleSelect.className = "role-select";
      roleSelect.addEventListener("change", () => updateUserRole(user.key, roleSelect.value));
      roleCell.appendChild(roleSelect);

      const actionsCell = document.createElement("td");
      const resetLinkBtn = document.createElement("button");
      resetLinkBtn.textContent = "Reset link";
      resetLinkBtn.className = "secondary";
      resetLinkBtn.addEventListener("click", () => resetUserLinks(user.key));

      actionsCell.appendChild(resetLinkBtn);

      row.append(userCell, emailCell, roleCell, actionsCell);
      usersTable.appendChild(row);
    });
}

async function updateUserRole(userKey, role) {
  try {
    await update(ref(db, `users/${userKey}`), { role: normalizeRole(role) });
    usersStatus.textContent = "Rol actualizado.";
    usersStatus.classList.remove("error");
  } catch (error) {
    console.error("updateUserRole", error);
    usersStatus.textContent = "No se pudo actualizar el rol.";
    usersStatus.classList.add("error");
  }
}

async function resetUserLinks(userKey) {
  try {
    const linksRef = ref(db, `userLinks/${userKey}`);
    await remove(linksRef);
    usersStatus.textContent = "Los enlaces asignados al usuario fueron reiniciados.";
    usersStatus.classList.remove("error");
  } catch (error) {
    console.error("resetUserLinks", error);
    usersStatus.textContent = "No se pudieron limpiar los enlaces del usuario.";
    usersStatus.classList.add("error");
  }
}


linksForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  linksFormStatus.textContent = "Guardando...";
  linksFormStatus.classList.remove("error");

  const formData = new FormData(linksForm);
  const name = formData.get("name")?.toString().trim() ?? "";
  const url = formData.get("url")?.toString().trim() ?? "";
  const minRole = formData.get("minRole")?.toString() ?? ROLE_ORDER[0];

  if (!name || !url) {
    linksFormStatus.textContent = "Completa todos los campos.";
    linksFormStatus.classList.add("error");
    return;
  }

  try {
    const linkData = {
      name,
      url,
      minRole,
      createdAt: Date.now(),
      createdBy: session.username,
    };
    const newRef = ref(db, "links");
    const linkKey = await set(ref(db, `links/${crypto.randomUUID()}`), linkData);
    console.log("linkKey", linkKey);
    linksForm.reset();
    linksFormStatus.textContent = "Enlace publicado.";
  } catch (error) {
    console.error("create link", error);
    linksFormStatus.textContent = "No se pudo publicar el enlace.";
    linksFormStatus.classList.add("error");
  }
});


const linksRef = ref(db, "links");
onValue(
  linksRef,
  (snapshot) => {
    const data = snapshot.val() ?? {};
    const entries = Object.entries(data).map(([key, value]) => ({
      key,
      name: value.name ?? "Sin nombre",
      url: value.url ?? "#",
      minRole: normalizeRole(value.minRole),
      createdAt: value.createdAt ?? 0,
      createdBy: value.createdBy ?? "desconocido",
    }));
    renderLinks(entries);
  },
  (error) => {
    console.error("links listener", error);
    linksFormStatus.textContent = "No se pudieron cargar los enlaces.";
    linksFormStatus.classList.add("error");
  }
);

function renderLinks(links) {
  linksList.innerHTML = "";
  if (links.length === 0) {
    linksCount.textContent = "Sin registros aún.";
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Publica tu primer enlace para verlo en el dashboard.";
    linksList.appendChild(empty);
    return;
  }

  linksCount.textContent = `${links.length} enlaces publicados.`;

  links
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
    .forEach((link) => {
      const card = document.createElement("article");
      card.className = "link-card";

      const header = document.createElement("header");
      const title = document.createElement("h3");
      title.textContent = link.name;
      const badge = document.createElement("span");
      badge.className = "role-badge";
      badge.textContent = link.minRole.toUpperCase();
      header.append(title, badge);

      const urlButton = document.createElement("a");
      urlButton.href = link.url;
      urlButton.target = "_blank";
      urlButton.rel = "noopener noreferrer";
      urlButton.textContent = "Entrar";
      urlButton.className = "link-button";

      const meta = document.createElement("p");
      meta.className = "status";
      meta.textContent = `Publicado por ${link.createdBy} · ${new Date(link.createdAt).toLocaleString()}`;

      const actions = document.createElement("div");
      actions.className = "controls";

      const deleteBtn = document.createElement("button");
      deleteBtn.textContent = "Eliminar";
      deleteBtn.className = "danger";
      deleteBtn.addEventListener("click", () => deleteLink(link.key));

      actions.appendChild(deleteBtn);

      card.append(header, urlButton, meta, actions);
      linksList.appendChild(card);
    });
}

async function deleteLink(linkKey) {
  try {
    await remove(ref(db, `links/${linkKey}`));
    linksFormStatus.textContent = "Enlace eliminado.";
    linksFormStatus.classList.remove("error");
  } catch (error) {
    console.error("deleteLink", error);
    linksFormStatus.textContent = "No se pudo eliminar el enlace.";
    linksFormStatus.classList.add("error");
  }
}
