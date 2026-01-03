import { db, ref, get, set } from "./base.js";
import {
  setSessionCookie,
  getSessionCookie,
  ROLE_ORDER,
  normalizeRole,
} from "./session.js";

const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");
const toggleButtons = document.querySelectorAll(".toggle-btn");
const linkToggles = document.querySelectorAll(".link-toggle");
const statusBox = document.querySelector(".form-status");
const yearNode = document.getElementById("current-year");

if (yearNode) {
  yearNode.textContent = new Date().getFullYear();
}

const activeSession = getSessionCookie();
if (activeSession) {
  window.location.replace("cartelhax/");
}

const forms = {
  login: loginForm,
  register: registerForm,
};

toggleButtons.forEach((btn) => {
  btn.addEventListener("click", () => switchForm(btn.dataset.target));
});

linkToggles.forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    switchForm(link.dataset.target);
  });
});

function switchForm(target) {
  if (!forms[target]) return;

  Object.entries(forms).forEach(([key, form]) => {
    const isTarget = key === target;
    form.classList.toggle("hidden", !isTarget);
    if (!isTarget) {
      form.reset();
    }
  });

  toggleButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.target === target);
  });

  setStatus();
}

loginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus("Verificando credenciales...");

  const formData = new FormData(loginForm);
  const username = formData.get("username")?.toString().trim() ?? "";
  const password = formData.get("password")?.toString() ?? "";

  if (!username || !password) {
    setStatus("Completa todos los campos.", "error");
    disableForm(loginForm, false);
    return;
  }

  disableForm(loginForm, true);

  try {
    const usernameKey = buildUserKey(username);
    const userSnapshot = await get(ref(db, `users/${usernameKey}`));

    if (!userSnapshot.exists()) {
      setStatus("Ese usuario no existe. Crea una cuenta.", "error");
      return;
    }

    const userData = userSnapshot.val();
    const passwordHash = await hashPassword(password);

    if (userData.passwordHash !== passwordHash) {
      setStatus("Credenciales inválidas.", "error");
      return;
    }

    setStatus("Acceso concedido. Redirigiendo...", "success");
    loginForm.reset();
    setSessionCookie({
      username,
      email: userData.email,
      role: normalizeRole(userData.role),
      userKey: usernameKey,
    });
    setTimeout(() => {
      window.location.href = "cartelhax/";
    }, 1200);
  } catch (error) {
    console.error(error);
    setStatus(getErrorMessage(error), "error");
  } finally {
    disableForm(loginForm, false);
  }
});

registerForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus("Creando cuenta...");

  const formData = new FormData(registerForm);
  const username = formData.get("username")?.toString().trim() ?? "";
  const email = formData.get("email")?.toString().trim().toLowerCase() ?? "";
  const password = formData.get("password")?.toString() ?? "";

  if (!username || !email || !password) {
    setStatus("Completa todos los campos.", "error");
    disableForm(registerForm, false);
    return;
  }

  disableForm(registerForm, true);

  try {
    const usernameKey = buildUserKey(username);
    const emailKey = buildEmailKey(email);

    const userRef = ref(db, `users/${usernameKey}`);
    const emailRef = ref(db, `emails/${emailKey}`);

    const [userSnapshot, emailSnapshot] = await Promise.all([
      get(userRef),
      get(emailRef),
    ]);

    if (userSnapshot.exists()) {
      setStatus("Ese usuario ya está registrado.", "error");
      return;
    }

    if (emailSnapshot.exists()) {
      setStatus("Ese correo ya está vinculado a otra cuenta.", "error");
      return;
    }

    const passwordHash = await hashPassword(password);
    const now = Date.now();
    const role = ROLE_ORDER[0];

    await Promise.all([
      set(userRef, {
        username,
        email,
        passwordHash,
        role,
        createdAt: now,
      }),
      set(emailRef, {
        username,
        usernameKey,
        createdAt: now,
      }),
    ]);

    setStatus("Cuenta creada. Ahora inicia sesión.", "success");
    prefillLogin({ username, email, password });
    registerForm.reset();
    setTimeout(() => switchForm("login"), 900);
  } catch (error) {
    console.error(error);
    setStatus(getErrorMessage(error), "error");
  } finally {
    disableForm(registerForm, false);
  }
});

function setStatus(message = "", state = "") {
  if (!statusBox) return;
  statusBox.textContent = message;
  if (state) {
    statusBox.dataset.state = state;
  } else {
    delete statusBox.dataset.state;
  }
}

function disableForm(form, disabled) {
  form
    .querySelectorAll("input, button")
    .forEach((node) => (node.disabled = disabled));
}

function getErrorMessage(error) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Ocurrió un error inesperado.";
}

function buildUserKey(username) {
  return username.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function buildEmailKey(email) {
  return btoa(email).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function hashPassword(value) {
  const encoder = new TextEncoder();
  const buffer = encoder.encode(value);
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(digest));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function prefillLogin({ username, email, password }) {
  if (!loginForm) return;
  const usernameField = loginForm.querySelector('input[name="username"]');
  const emailField = loginForm.querySelector('input[name="email"]');
  const passwordField = loginForm.querySelector('input[name="password"]');

  if (usernameField) {
    usernameField.value = username;
  }
  if (emailField) {
    emailField.value = email;
  }
  if (passwordField) {
    passwordField.value = password;
  }
}
