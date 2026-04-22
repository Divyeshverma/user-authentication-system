const message = document.querySelector("#message");
const tabs = document.querySelectorAll(".tab");
const formEyebrow = document.querySelector("#formEyebrow");
const formTitle = document.querySelector("#formTitle");
const formHint = document.querySelector("#formHint");
const views = {
  register: document.querySelector("#registerView"),
  verify: document.querySelector("#verifyView"),
  login: document.querySelector("#loginView"),
  forgot: document.querySelector("#forgotView"),
};
const viewCopy = {
  register: {
    eyebrow: "Create Account",
    title: "Start with registration",
    hint: "After registration, copy the OTP from your server terminal and verify your email.",
  },
  verify: {
    eyebrow: "Email OTP",
    title: "Verify your email",
    hint: "Use the 6 digit OTP printed in the backend terminal after registration.",
  },
  login: {
    eyebrow: "Welcome Back",
    title: "Login to dashboard",
    hint: "Only verified users can login and access protected profile details.",
  },
  forgot: {
    eyebrow: "Password Help",
    title: "Reset your password",
    hint: "Send a reset OTP, copy it from the terminal, then choose a new password.",
  },
};

function showMessage(text, isError = false) {
  message.textContent = text;
  message.classList.toggle("error", isError);
}

function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

async function request(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Something went wrong");
  }

  return data;
}

function switchView(name) {
  Object.entries(views).forEach(([viewName, element]) => {
    element.classList.toggle("active", viewName === name);
  });
  tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.view === name));
  formEyebrow.textContent = viewCopy[name].eyebrow;
  formTitle.textContent = viewCopy[name].title;
  formHint.textContent = viewCopy[name].hint;
  showMessage("");
}

async function withLoading(button, task) {
  const label = button.querySelector(".button-text") || button;
  const originalText = label.textContent;
  button.disabled = true;
  label.textContent = "Please wait...";

  try {
    return await task();
  } finally {
    label.textContent = originalText;
    button.disabled = false;
  }
}

function saveSession(token, user) {
  localStorage.setItem("authToken", token);
  localStorage.setItem("authUser", JSON.stringify(user));
  renderProfile(user);
}

function clearSession() {
  localStorage.removeItem("authToken");
  localStorage.removeItem("authUser");
  document.querySelector("#dashboard").hidden = true;
}

function renderProfile(user) {
  document.querySelector("#dashboard").hidden = false;
  document.querySelector("#profileName").textContent = `Welcome, ${user.name}`;

  const rows = [
    ["Name", user.name],
    ["Email", user.email],
    ["Mobile", user.mobile],
    ["Gender", user.gender],
    ["State", user.state],
    ["Pin code", user.pinCode],
    ["Verified", user.isVerified ? "Yes" : "No"],
    ["Registration date", new Date(user.registeredAt).toLocaleString()],
  ];

  document.querySelector("#profileDetails").innerHTML = rows
    .map(([label, value]) => `<div class="profile-row"><dt>${label}</dt><dd>${value || "-"}</dd></div>`)
    .join("");
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => switchView(tab.dataset.view));
});

views.register.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = event.currentTarget.querySelector("button[type='submit']");
  try {
    const data = await withLoading(button, () =>
      request("/api/register", {
        method: "POST",
        body: JSON.stringify(formData(event.currentTarget)),
      })
    );
    showMessage(data.message);
    switchView("verify");
    views.verify.email.value = event.currentTarget.email.value;
  } catch (error) {
    showMessage(error.message, true);
  }
});

views.verify.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = event.currentTarget.querySelector("button[type='submit']");
  try {
    const data = await withLoading(button, () =>
      request("/api/verify-otp", {
        method: "POST",
        body: JSON.stringify(formData(event.currentTarget)),
      })
    );
    showMessage(data.message);
    switchView("login");
    views.login.email.value = event.currentTarget.email.value;
  } catch (error) {
    showMessage(error.message, true);
  }
});

views.login.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = event.currentTarget.querySelector("button[type='submit']");
  try {
    const data = await withLoading(button, () =>
      request("/api/login", {
        method: "POST",
        body: JSON.stringify(formData(event.currentTarget)),
      })
    );
    saveSession(data.token, data.user);
    showMessage(data.message);
  } catch (error) {
    showMessage(error.message, true);
  }
});

document.querySelector("#sendResetOtp").addEventListener("click", async () => {
  const button = document.querySelector("#sendResetOtp");
  try {
    const data = await withLoading(button, () =>
      request("/api/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: views.forgot.email.value }),
      })
    );
    showMessage(data.message);
  } catch (error) {
    showMessage(error.message, true);
  }
});

views.forgot.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = event.currentTarget.querySelector("button[type='submit']");
  try {
    const data = await withLoading(button, () =>
      request("/api/reset-password", {
        method: "POST",
        body: JSON.stringify(formData(event.currentTarget)),
      })
    );
    showMessage(data.message);
    switchView("login");
    views.login.email.value = event.currentTarget.email.value;
  } catch (error) {
    showMessage(error.message, true);
  }
});

document.querySelector("#logoutBtn").addEventListener("click", () => {
  clearSession();
  switchView("login");
  showMessage("Logged out successfully.");
});

async function restoreProfile() {
  const token = localStorage.getItem("authToken");
  if (!token) return;

  try {
    const data = await request("/api/profile", {
      headers: { Authorization: `Bearer ${token}` },
    });
    renderProfile(data.user);
  } catch {
    clearSession();
  }
}

restoreProfile();
