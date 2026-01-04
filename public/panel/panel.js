import { db, ref, onValue, update, set, remove, get } from "../base.js";
import { ROLE_ORDER, normalizeRole, normalizeRoles } from "../session.js";

const PANEL_PASSWORD = "cartelpanelv2";
const PANEL_UNLOCK_KEY = "cartelhax_panel_unlock";

const gateSection = document.getElementById("panel-gate");
const gateForm = document.getElementById("gate-form");
const gateStatus = document.getElementById("gate-status");
const panelShell = document.querySelector("main.panel");
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
const customRoleForm = document.getElementById("custom-role-form");
const customRoleStatus = document.getElementById("custom-role-status");
const customRolesList = document.getElementById("custom-roles-list");
const customRolesCount = document.getElementById("custom-roles-count");

let linksFormBound = false;
let panelInitialized = false;
let unsubscribeUsers = null;
let unsubscribeLinks = null;
let unsubscribeCustomRoles = null;
let customRoles = [];
let currentUsers = [];

gateForm?.addEventListener("submit", handleGateSubmit);
logoutBtn?.addEventListener("click", () => {
  lockPanel();
});

async function handleCustomRoleSubmit(event) {
  event.preventDefault();
  if (!customRoleForm) return;

  if (customRoleStatus) {
    customRoleStatus.textContent = "Guardando...";
    customRoleStatus.classList.remove("error");
  }

  const formData = new FormData(customRoleForm);
  const roleNameRaw = formData.get("roleName")?.toString().trim() ?? "";
  const normalized = normalizeRole(roleNameRaw);

  if (!roleNameRaw || !normalized) {
    if (customRoleStatus) {
      customRoleStatus.textContent = "Ingresa un nombre válido.";
      customRoleStatus.classList.add("error");
    }
    return;
  }

  if (ROLE_ORDER.includes(normalized)) {
    if (customRoleStatus) {
      customRoleStatus.textContent = "Ese rango ya existe como predeterminado.";
      customRoleStatus.classList.add("error");
    }
    return;
  }

  if (customRoles.some((r) => r.value === normalized)) {
    if (customRoleStatus) {
      customRoleStatus.textContent = "Ese rango personalizado ya existe.";
      customRoleStatus.classList.add("error");
    }
    return;
  }

  const roleId = normalized.replace(/[^a-z0-9_-]+/g, "-") || crypto.randomUUID();

  try {
    await set(ref(db, `customRoles/${roleId}`), {
      name: roleNameRaw,
      value: normalized,
      createdAt: Date.now(),
    });
    customRoleForm.reset();
    if (customRoleStatus) {
      customRoleStatus.textContent = "Rango creado.";
      customRoleStatus.classList.remove("error");
    }
  } catch (error) {
    console.error("createCustomRole", error);
    if (customRoleStatus) {
      customRoleStatus.textContent = "No se pudo crear el rango.";
      customRoleStatus.classList.add("error");
    }
  }
}

function renderCustomRoles() {
  if (!customRolesList) return;
  customRolesList.innerHTML = "";

  if (customRoles.length === 0) {
    if (customRolesCount) {
      customRolesCount.textContent = "Sin rangos personalizados.";
    }
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Crea un rango personalizado para usarlo en enlaces y usuarios.";
    customRolesList.appendChild(empty);
    return;
  }

  if (customRolesCount) {
    customRolesCount.textContent = `${customRoles.length} rangos personalizados.`;
  }

  customRoles
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
    .forEach((role) => {
      const card = document.createElement("article");
      card.className = "link-card";

      const header = document.createElement("header");
      const title = document.createElement("h3");
      title.textContent = role.name?.toUpperCase() ?? role.value.toUpperCase();
      const badge = document.createElement("span");
      badge.className = "role-badge";
      badge.textContent = "PERSONALIZADO";
      header.append(title, badge);

      const meta = document.createElement("p");
      meta.className = "status";
      meta.textContent = `ID: ${role.value}`;

      const actions = document.createElement("div");
      actions.className = "controls";

      const deleteBtn = document.createElement("button");
      deleteBtn.textContent = "Eliminar";
      deleteBtn.className = "danger";
      deleteBtn.addEventListener("click", () => deleteCustomRole(role.key));

      actions.appendChild(deleteBtn);

      card.append(header, meta, actions);
      customRolesList.appendChild(card);
    });
}

async function deleteCustomRole(roleKey) {
  if (!roleKey) return;
  try {
    await remove(ref(db, `customRoles/${roleKey}`));
    if (customRoleStatus) {
      customRoleStatus.textContent = "Rango eliminado.";
      customRoleStatus.classList.remove("error");
    }
  } catch (error) {
    console.error("deleteCustomRole", error);
    if (customRoleStatus) {
      customRoleStatus.textContent = "No se pudo eliminar el rango.";
      customRoleStatus.classList.add("error");
    }
  }
}

function rebuildMinRoleSelect() {
  if (!minRoleSelect) return;
  const currentValue = minRoleSelect.value;
  minRoleSelect.innerHTML = "";
  getRoleOptions().forEach((role) => {
    const option = document.createElement("option");
    option.value = role.value;
    option.textContent = role.label;
    minRoleSelect.appendChild(option);
  });
  if (currentValue) {
    minRoleSelect.value = currentValue;
  }
}
backBtn?.addEventListener("click", () => {
  window.location.replace("/cartelhax/");
});

try {
  if (localStorage.getItem(PANEL_UNLOCK_KEY) === "true") {
    unlockPanel();
  }
} catch (error) {
  console.warn("No se pudo recuperar el estado del panel", error);
}

function handleGateSubmit(event) {
  event.preventDefault();
  if (!gateForm) return;

  const formData = new FormData(gateForm);
  const password = formData.get("password")?.toString().trim() ?? "";

  if (password !== PANEL_PASSWORD) {
    if (gateStatus) {
      gateStatus.textContent = "Contraseña incorrecta.";
      gateStatus.classList.add("error");
    }
    return;
  }

  if (gateStatus) {
    gateStatus.textContent = "";
    gateStatus.classList.remove("error");
  }

  gateForm.reset();
  unlockPanel();
}

function unlockPanel() {
  if (panelShell) {
    panelShell.hidden = false;
    panelShell.classList.remove("is-hidden");
    panelShell.dataset.state = "unlocked";
  }
  if (gateSection) {
    gateSection.hidden = true;
    gateSection.classList.add("is-hidden");
  }
  if (adminSummary) {
    adminSummary.textContent = "Acceso administrador activo";
  }

  try {
    localStorage.setItem(PANEL_UNLOCK_KEY, "true");
  } catch (error) {
    console.warn("No se pudo guardar el estado del panel", error);
  }

  if (!panelInitialized) {
    initializePanel();
    panelInitialized = true;
  }

  subscribeUsers();
  subscribeLinks();
  subscribeCustomRoles();
}

function lockPanel() {
  if (panelShell) {
    panelShell.hidden = true;
    panelShell.classList.add("is-hidden");
    panelShell.dataset.state = "locked";
  }
  if (gateSection) {
    gateSection.hidden = false;
    gateSection.classList.remove("is-hidden");
  }
  if (adminSummary) {
    adminSummary.textContent = "Panel bloqueado";
  }
  if (gateStatus) {
    gateStatus.textContent = "";
    gateStatus.classList.remove("error");
  }
  if (linksFormStatus) {
    linksFormStatus.textContent = "";
    linksFormStatus.classList.remove("error");
  }
  if (usersStatus) {
    usersStatus.textContent = "";
    usersStatus.classList.remove("error");
  }
  try {
    localStorage.removeItem(PANEL_UNLOCK_KEY);
  } catch (error) {
    console.warn("No se pudo limpiar el estado del panel", error);
  }
  if (unsubscribeUsers) {
    unsubscribeUsers();
    unsubscribeUsers = null;
  }
  if (unsubscribeLinks) {
    unsubscribeLinks();
    unsubscribeLinks = null;
  }
  if (unsubscribeCustomRoles) {
    unsubscribeCustomRoles();
    unsubscribeCustomRoles = null;
  }
  if (usersTable) {
    usersTable.innerHTML = "";
  }
  if (linksList) {
    linksList.innerHTML = "";
  }
  if (linksCount) {
    linksCount.textContent = "Sin registros aún.";
  }
}

function initializePanel() {
  if (minRoleSelect && minRoleSelect.childElementCount === 0) {
    rebuildMinRoleSelect();

    const infoNote = document.createElement("div");
    infoNote.className = "role-info";
    infoNote.style.marginTop = "12px";
    infoNote.style.padding = "10px";
    infoNote.style.borderRadius = "8px";
    infoNote.style.background = "rgba(0, 0, 0, 0.1)";
    infoNote.style.fontSize = "0.85em";
    infoNote.style.color = "var(--muted)";

    const title = document.createElement("div");
    title.textContent = "INFORMACIÓN DE RANGOS";
    title.style.fontWeight = "bold";
    title.style.marginBottom = "8px";
    title.style.color = "var(--primary)";

    const rolesList = document.createElement("div");
    rolesList.style.display = "grid";
    rolesList.style.gap = "4px";

    const roleInfo = {
      miembro: "APARECE A TODOS LOS RANGOS",
      premium: "ACCESO EXCLUSIVO PARA USUARIOS PREMIUM",
      vip: "ACCESO EXCLUSIVO PARA USUARIOS VIP",
      diamantes: "SOLO PARA RANGO DIAMANTES",
    };

    ROLE_ORDER.forEach((role) => {
      const roleDiv = document.createElement("div");
      roleDiv.style.display = "flex";
      roleDiv.style.gap = "8px";

      const roleName = document.createElement("span");
      roleName.textContent = role === "miembro" ? "TODOS" : role.toUpperCase();
      roleName.style.fontWeight = "600";
      roleName.style.minWidth = "80px";

      const roleDesc = document.createElement("span");
      roleDesc.textContent = roleInfo[role];

      roleDiv.append(roleName, roleDesc);
      rolesList.appendChild(roleDiv);
    });

    infoNote.append(title, rolesList);
    minRoleSelect.parentNode.insertBefore(infoNote, minRoleSelect.nextSibling);
  }

  if (!linksFormBound && linksForm) {
    linksForm.addEventListener("submit", handleLinkSubmit);
    linksFormBound = true;
  }

  customRoleForm?.addEventListener("submit", handleCustomRoleSubmit);
}

function subscribeUsers() {
  if (!usersTable) return;
  if (unsubscribeUsers) {
    unsubscribeUsers();
  }

  const usersRef = ref(db, "users");
  unsubscribeUsers = onValue(
    usersRef,
    (snapshot) => {
      if (usersStatus) {
        usersStatus.textContent = "";
        usersStatus.classList.remove("error");
      }
      const data = snapshot.val() ?? {};
      const entries = Object.entries(data).map(([key, value]) => ({
        key,
        username: value.username,
        email: value.email,
        role: normalizeRole(value.role),
        roles: normalizeRoles(value.roles?.length ? value.roles : value.role ? [value.role] : []),
        createdAt: value.createdAt ?? 0,
      }));
      currentUsers = entries;
      renderUsers(entries);
    },
    (error) => {
      console.error("users listener", error);
      if (usersStatus) {
        usersStatus.textContent = "No se pudo cargar la lista de usuarios.";
        usersStatus.classList.add("error");
      }
    }
  );
}

function subscribeLinks() {
  if (!linksList) return;
  if (unsubscribeLinks) {
    unsubscribeLinks();
  }

  const linksRef = ref(db, "links");
  unsubscribeLinks = onValue(
    linksRef,
    (snapshot) => {
      const data = snapshot.val() ?? {};
      const entries = Object.entries(data).map(([key, value]) => ({
        key,
        name: value.name ?? "Sin nombre",
        description: value.description ?? "",
        url: value.url ?? "#",
        minRole: normalizeRole(value.minRole),
        createdAt: value.createdAt ?? 0,
        createdBy: value.createdBy ?? "panel",
        status: value.status === "offline" ? "offline" : "online",
      }));
      renderLinks(entries);
    },
    (error) => {
      console.error("links listener", error);
      if (linksFormStatus) {
        linksFormStatus.textContent = "No se pudieron cargar los enlaces.";
        linksFormStatus.classList.add("error");
      }
    }
  );
}

function subscribeCustomRoles() {
  if (!customRolesList) return;
  if (unsubscribeCustomRoles) {
    unsubscribeCustomRoles();
  }

  const customRolesRef = ref(db, "customRoles");
  unsubscribeCustomRoles = onValue(
    customRolesRef,
    (snapshot) => {
      const data = snapshot.val() ?? {};
      customRoles = Object.entries(data).map(([key, value]) => ({
        key,
        name: value.name ?? value.value ?? key,
        value: normalizeRole(value.value ?? key),
        createdAt: value.createdAt ?? 0,
      }));
      renderCustomRoles();
      rebuildMinRoleSelect();
      renderUsers(currentUsers);
    },
    (error) => {
      console.error("customRoles listener", error);
      if (customRoleStatus) {
        customRoleStatus.textContent = "No se pudieron cargar los rangos personalizados.";
        customRoleStatus.classList.add("error");
      }
    }
  );
}

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
      const chipContainer = document.createElement("div");
      chipContainer.className = "role-chips";

      const currentRoles = user.roles?.length ? user.roles : user.role ? [user.role] : [];
      currentRoles.forEach((roleValue) => {
        const chip = document.createElement("span");
        chip.className = "role-chip";
        chip.textContent = roleValue.toUpperCase();
        const removeBtn = document.createElement("button");
        removeBtn.className = "remove";
        removeBtn.type = "button";
        removeBtn.textContent = "×";
        removeBtn.addEventListener("click", () => {
          const updated = currentRoles.filter((r) => r !== roleValue);
          updateUserRoles(user.key, updated);
        });
        chip.appendChild(removeBtn);
        chipContainer.appendChild(chip);
      });

      const addSelect = document.createElement("select");
      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = "Agregar rol…";
      placeholder.disabled = true;
      placeholder.selected = true;
      addSelect.appendChild(placeholder);

      getRoleOptions().forEach((roleOption) => {
        if (currentRoles.includes(roleOption.value)) return;
        const option = document.createElement("option");
        option.value = roleOption.value;
        option.textContent = roleOption.label;
        addSelect.appendChild(option);
      });
      addSelect.className = "role-select";
      addSelect.addEventListener("change", () => {
        const value = addSelect.value;
        if (!value) return;
        const updated = Array.from(new Set([...currentRoles, value]));
        updateUserRoles(user.key, updated);
      });

      roleCell.append(chipContainer, addSelect);

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

async function updateUserRoles(userKey, roles) {
  try {
    const normalizedRoles = normalizeRoles(roles);
    await update(ref(db, `users/${userKey}`), {
      role: normalizedRoles[0] ?? ROLE_ORDER[0],
      roles: normalizedRoles,
    });
    if (usersStatus) {
      usersStatus.textContent = "Roles actualizados.";
      usersStatus.classList.remove("error");
    }
  } catch (error) {
    console.error("updateUserRoles", error);
    if (usersStatus) {
      usersStatus.textContent = "No se pudieron actualizar los roles.";
      usersStatus.classList.add("error");
    }
  }
}

async function resetUserLinks(userKey) {
  try {
    const target = ref(db, `userLinks/${userKey}`);
    await remove(target);
    if (usersStatus) {
      usersStatus.textContent = "Los enlaces asignados al usuario fueron reiniciados.";
      usersStatus.classList.remove("error");
    }
  } catch (error) {
    console.error("resetUserLinks", error);
    if (usersStatus) {
      usersStatus.textContent = "No se pudieron limpiar los enlaces del usuario.";
      usersStatus.classList.add("error");
    }
  }
}

function getRoleOptions() {
  const base = ROLE_ORDER.map((role) => ({
    value: role,
    label: role === "miembro" ? "TODOS" : role.toUpperCase(),
    isCustom: false,
  }));
  const customs = customRoles.map((role) => ({
    value: role.value,
    label: role.name?.toUpperCase() ?? role.value.toUpperCase(),
    isCustom: true,
  }));
  return [...base, ...customs];
}

function handleLinkSubmit(event) {
  event.preventDefault();
  if (!linksForm) return;

  if (linksFormStatus) {
    linksFormStatus.textContent = "Guardando...";
    linksFormStatus.classList.remove("error");
  }

  const formData = new FormData(linksForm);
  const name = formData.get("name")?.toString().trim() ?? "";
  const description = formData.get("description")?.toString().trim() ?? "";
  const url = formData.get("url")?.toString().trim() ?? "";
  const minRole = formData.get("minRole")?.toString() ?? ROLE_ORDER[0];
  const status = formData.get("status")?.toString() ?? "online";

  if (!name || !description || !url) {
    if (linksFormStatus) {
      linksFormStatus.textContent = "Completa todos los campos.";
      linksFormStatus.classList.add("error");
    }
    return;
  }

  createLink({
    name,
    description,
    url,
    minRole: normalizeRole(minRole),
    status: status === "offline" ? "offline" : "online",
  });
}

async function createLink(linkData) {
  try {
    await set(ref(db, `links/${crypto.randomUUID()}`), {
      ...linkData,
      createdAt: Date.now(),
      createdBy: "panel_admin",
      status: linkData.status ?? "online",
    });
    if (linksForm) {
      linksForm.reset();
    }
    if (linksFormStatus) {
      linksFormStatus.textContent = "Enlace publicado.";
      linksFormStatus.classList.remove("error");
    }
  } catch (error) {
    console.error("create link", error);
    if (linksFormStatus) {
      linksFormStatus.textContent = "No se pudo publicar el enlace.";
      linksFormStatus.classList.add("error");
    }
  }
}

function renderLinks(links) {
  if (!linksList) return;
  linksList.innerHTML = "";

  if (links.length === 0) {
    if (linksCount) {
      linksCount.textContent = "Sin registros aún.";
    }
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Publica tu primer enlace para verlo en el dashboard.";
    linksList.appendChild(empty);
    return;
  }

  if (linksCount) {
    linksCount.textContent = `${links.length} enlaces publicados.`;
  }

  links
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
    .forEach((link) => {
      const card = document.createElement("article");
      card.className = "link-card";
      card.setAttribute('data-link-id', link.key);

      const header = document.createElement("header");
      const title = document.createElement("h3");
      title.textContent = link.name;
      const badge = document.createElement("span");
      badge.className = "role-badge";
      badge.textContent = link.minRole.toUpperCase();
      header.append(title, badge);

      const statusBadge = document.createElement("span");
      statusBadge.className = "role-badge";
      statusBadge.style.background = link.status === "offline" ? "var(--danger)" : "var(--primary)";
      statusBadge.textContent = link.status === "offline" ? "OFFLINE" : "ONLINE";
      header.appendChild(statusBadge);

      const urlButton = document.createElement("a");
      urlButton.href = link.url;
      urlButton.target = "_blank";
      urlButton.rel = "noopener noreferrer";
      urlButton.textContent = "Descargar";
      urlButton.className = "link-button";

      const meta = document.createElement("p");
      meta.className = "status";
      const createdAt = link.createdAt ? new Date(link.createdAt).toLocaleString() : "fecha desconocida";
      meta.textContent = `Publicado por ${link.createdBy} · ${createdAt}`;

      
      const description = document.createElement("div");
      description.className = "status";
      description.style.whiteSpace = 'pre-line'; 
      
      const maxLength = 120; 
      const fullText = link.description || "";
      let isExpanded = false;
      
      
      const updateText = () => {
    
        description.innerHTML = '';
        
        
        if (!fullText || fullText.trim() === '') {
          const noDesc = document.createElement('span');
          noDesc.textContent = 'Sin descripción.';
          noDesc.style.color = 'var(--muted)';
          description.appendChild(noDesc);
          return;
        }
        
        
        const textSpan = document.createElement('span');
        
        if (fullText.length <= maxLength || isExpanded) {
          
          textSpan.innerHTML = fullText.replace(/\n/g, '<br>');
          description.appendChild(textSpan);
          
          
          if (fullText.length > maxLength) {
            const toggleBtn = document.createElement('a');
            toggleBtn.href = '#';
            toggleBtn.textContent = ' ▼ Ver menos';
            toggleBtn.style.color = '#4fc3f7';
            toggleBtn.style.textDecoration = 'underline';
            toggleBtn.style.fontSize = '0.9em';
            toggleBtn.style.marginLeft = '6px';
            toggleBtn.style.fontWeight = '600';
            toggleBtn.style.transition = 'all 0.2s ease';
            toggleBtn.style.cursor = 'pointer';
            toggleBtn.style.whiteSpace = 'nowrap';
            toggleBtn.onmouseover = () => toggleBtn.style.opacity = '0.8';
            toggleBtn.onmouseout = () => toggleBtn.style.opacity = '1';
            toggleBtn.onclick = (e) => {
              e.preventDefault();
              isExpanded = false;
              updateText();
            };
            description.appendChild(document.createElement('br'));
            description.appendChild(toggleBtn);
          }
        } else {
          
          const truncated = fullText.substring(0, maxLength);
          const lastSpace = truncated.lastIndexOf(' ');
          const finalText = lastSpace > 0 ? truncated.substring(0, lastSpace) : truncated;
          
          textSpan.innerHTML = finalText + '...';
          description.appendChild(textSpan);
          
          
          const toggleBtn = document.createElement('a');
          toggleBtn.href = '#';
          toggleBtn.textContent = ' ▶ Ver más';
          toggleBtn.style.color = '#4fc3f7';
          toggleBtn.style.textDecoration = 'underline';
          toggleBtn.style.fontSize = '0.9em';
          toggleBtn.style.marginLeft = '6px';
          toggleBtn.style.fontWeight = '600';
          toggleBtn.style.transition = 'all 0.2s ease';
          toggleBtn.style.cursor = 'pointer';
          toggleBtn.style.whiteSpace = 'nowrap';
          toggleBtn.onmouseover = () => toggleBtn.style.opacity = '0.8';
          toggleBtn.onmouseout = () => toggleBtn.style.opacity = '1';
          toggleBtn.onclick = (e) => {
            e.preventDefault();
            isExpanded = true;
            updateText();
          };
          description.appendChild(document.createElement('br'));
          description.appendChild(toggleBtn);
        }
      };
      
    
      updateText();

      const actions = document.createElement("div");
      actions.className = "controls";

      const statusSelect = document.createElement("select");
      ["online", "offline"].forEach((state) => {
        const option = document.createElement("option");
        option.value = state;
        option.textContent = state.toUpperCase();
        if (state === link.status) option.selected = true;
        statusSelect.appendChild(option);
      });
      statusSelect.className = "role-select";
      statusSelect.addEventListener("change", () => updateLinkStatus(link.key, statusSelect.value));

      const editBtn = document.createElement("button");
      editBtn.textContent = "Editar";
      editBtn.className = "secondary";
      editBtn.style.marginRight = "8px";
      editBtn.addEventListener("click", () => showEditForm(link));

      const deleteBtn = document.createElement("button");
      deleteBtn.textContent = "Eliminar";
      deleteBtn.className = "danger";
      deleteBtn.addEventListener("click", () => deleteLink(link.key));

      actions.append(statusSelect, editBtn, deleteBtn);

      card.append(header, description, urlButton, meta, actions);
      linksList.appendChild(card);
    });
}

async function deleteLink(linkKey) {
  try {
    await remove(ref(db, `links/${linkKey}`));
    if (linksFormStatus) {
      linksFormStatus.textContent = "Enlace eliminado.";
      linksFormStatus.classList.remove("error");
    }
  } catch (error) {
    console.error("deleteLink", error);
    if (linksFormStatus) {
      linksFormStatus.textContent = "No se pudo eliminar el enlace.";
      linksFormStatus.classList.add("error");
    }
  }
}

async function updateLinkStatus(linkKey, status) {
  try {
    await update(ref(db, `links/${linkKey}`), { status });
  } catch (error) {
    console.error("updateLinkStatus", error);
    if (linksFormStatus) {
      linksFormStatus.textContent = "No se pudo actualizar el estado.";
      linksFormStatus.classList.add("error");
    }
  }
}

function showEditForm(link) {
  const formContainer = document.createElement('div');
  formContainer.className = 'edit-form';
  formContainer.style.marginTop = '16px';
  formContainer.style.padding = '16px';
  formContainer.style.border = '1px solid var(--border)';
  formContainer.style.borderRadius = '8px';
  formContainer.style.backgroundColor = 'var(--panel)';

  const form = document.createElement('form');
  form.className = 'link-form';
  
  const nameGroup = document.createElement('div');
  nameGroup.style.marginBottom = '12px';
  const nameLabel = document.createElement('label');
  nameLabel.textContent = 'Nombre del enlace';
  nameLabel.style.display = 'block';
  nameLabel.style.marginBottom = '4px';
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.name = 'edit-name';
  nameInput.value = link.name;
  nameInput.required = true;
  nameInput.style.width = '100%';
  nameGroup.append(nameLabel, nameInput);

  
  const urlGroup = document.createElement('div');
  urlGroup.style.marginBottom = '12px';
  const urlLabel = document.createElement('label');
  urlLabel.textContent = 'URL';
  urlLabel.style.display = 'block';
  urlLabel.style.marginBottom = '4px';
  const urlInput = document.createElement('input');
  urlInput.type = 'url';
  urlInput.name = 'edit-url';
  urlInput.value = link.url;
  urlInput.required = true;
  urlInput.style.width = '100%';
  urlGroup.append(urlLabel, urlInput);

  
  const descGroup = document.createElement('div');
  descGroup.style.marginBottom = '12px';
  const descLabel = document.createElement('label');
  descLabel.textContent = 'Descripción';
  descLabel.style.display = 'block';
  descLabel.style.marginBottom = '4px';
  const descInput = document.createElement('textarea');
  descInput.name = 'edit-description';
  descInput.value = link.description || '';
  descInput.style.width = '100%';
  descInput.style.minHeight = '80px';
  descGroup.append(descLabel, descInput);

  
  const roleGroup = document.createElement('div');
  roleGroup.style.marginBottom = '16px';
  const roleLabel = document.createElement('label');
  roleLabel.textContent = 'Rango mínimo';
  roleLabel.style.display = 'block';
  roleLabel.style.marginBottom = '4px';
  const roleSelect = document.createElement('select');
  roleSelect.name = 'edit-minRole';
  roleSelect.style.width = '100%';
  
  
  const roleOptions = getRoleOptions();
  roleOptions.forEach(roleOption => {
    const option = document.createElement('option');
    option.value = roleOption.value;
    option.textContent = roleOption.label;
    if (roleOption.value === link.minRole) option.selected = true;
    roleSelect.appendChild(option);
  });
  roleGroup.append(roleLabel, roleSelect);

  
  const buttonGroup = document.createElement('div');
  buttonGroup.style.display = 'flex';
  const buttonStyle = 'padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; margin-right: 8px;';
  
  const saveButton = document.createElement('button');
  saveButton.type = 'submit';
  saveButton.textContent = 'Guardar';
  saveButton.style = buttonStyle + 'background: var(--primary); color: white;';
  
  const cancelButton = document.createElement('button');
  cancelButton.type = 'button';
  cancelButton.textContent = 'Cancelar';
  cancelButton.style = buttonStyle + 'background: var(--border);';
  cancelButton.addEventListener('click', () => formContainer.remove());
  
  buttonGroup.append(saveButton, cancelButton);

  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const updates = {
      name: nameInput.value.trim(),
      url: urlInput.value.trim(),
      description: descInput.value.trim(),
      minRole: roleSelect.value,
      updatedAt: Date.now()
    };

    try {
      await update(ref(db, `links/${link.key}`), updates);
      formContainer.remove();
    } catch (error) {
      console.error('Error al actualizar el enlace:', error);
      alert('No se pudo actualizar el enlace. Intenta de nuevo.');
    }
  });

  
  form.append(nameGroup, urlGroup, descGroup, roleGroup, buttonGroup);
  formContainer.appendChild(form);
  
  
  const card = document.querySelector(`[data-link-id="${link.key}"]`);
  if (card) {
    
    const existingForm = card.querySelector('.edit-form');
    if (existingForm) existingForm.remove();
    
    card.appendChild(formContainer);
    nameInput.focus();
  }
}
