// ============================================
// Campus360 — Auth JS (login.html)
// ============================================

const API_BASE = "php/auth.php";

// --- Tab Switching (login/signup only, not account type) ---
document.querySelectorAll(".auth-tabs > .auth-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document
      .querySelectorAll(".auth-tabs > .auth-tab")
      .forEach((t) => t.classList.remove("active"));
    document
      .querySelectorAll(".auth-form")
      .forEach((f) => f.classList.remove("active"));
    tab.classList.add("active");
    const formId = tab.dataset.tab === "login" ? "loginForm" : "signupForm";
    document.getElementById(formId).classList.add("active");
    clearMessage();
  });
});

// --- Account type toggle (student/club) ---
function setAccountType(type) {
  document.getElementById("signupAccountType").value = type;
  const studentBtn = document.getElementById("accTypeStudent");
  const clubBtn = document.getElementById("accTypeClub");
  const regnoGroup = document.getElementById("regnoGroup");
  const clubFields = document.getElementById("clubFields");
  const nameLabel = document.getElementById("signupNameLabel");
  const regnoInput = document.getElementById("signupRegno");

  if (type === "club") {
    clubBtn.classList.add("active");
    studentBtn.classList.remove("active");
    regnoGroup.style.display = "none";
    regnoInput.required = false;
    clubFields.style.display = "block";
    nameLabel.textContent = "Club Name";
    document.getElementById("signupName").placeholder =
      "e.g. IEEE Student Branch";
    document.getElementById("signupUsername").placeholder = "e.g. ieee_vitc";
  } else {
    studentBtn.classList.add("active");
    clubBtn.classList.remove("active");
    regnoGroup.style.display = "flex";
    regnoInput.required = true;
    clubFields.style.display = "none";
    nameLabel.textContent = "Full Name";
    document.getElementById("signupName").placeholder = "e.g. Priya Sharma";
    document.getElementById("signupUsername").placeholder = "e.g. priya_s";
  }
}

// --- Message display ---
function showMessage(text, type = "error") {
  const el = document.getElementById("authMessage");
  el.textContent = text;
  el.className = "auth-message " + type;
}

function clearMessage() {
  const el = document.getElementById("authMessage");
  el.className = "auth-message";
  el.textContent = "";
}

// --- Login ---
document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  clearMessage();
  const btn = e.target.querySelector(".auth-submit");
  btn.disabled = true;
  btn.textContent = "Logging in...";

  try {
    const formData = new FormData();
    formData.append("action", "login");
    formData.append(
      "identifier",
      document.getElementById("loginIdentifier").value.trim(),
    );
    formData.append("password", document.getElementById("loginPassword").value);

    const res = await fetch(API_BASE, { method: "POST", body: formData });
    const data = await res.json();

    if (data.success) {
      showMessage("Login successful! Redirecting...", "success");
      setTimeout(() => {
        window.location.href = "index.html";
      }, 800);
    } else {
      showMessage(data.error || "Login failed");
    }
  } catch (err) {
    showMessage("Network error. Make sure WAMP is running.");
  }

  btn.disabled = false;
  btn.textContent = "Login";
});

// --- Signup ---
document.getElementById("signupForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  clearMessage();
  const btn = e.target.querySelector(".auth-submit");
  btn.disabled = true;
  btn.textContent = "Creating account...";

  const accountType = document.getElementById("signupAccountType").value;

  try {
    const formData = new FormData();
    formData.append("action", "signup");
    formData.append("account_type", accountType);
    formData.append("name", document.getElementById("signupName").value.trim());
    formData.append(
      "username",
      document.getElementById("signupUsername").value.trim(),
    );
    formData.append(
      "email",
      document.getElementById("signupEmail").value.trim(),
    );
    formData.append(
      "password",
      document.getElementById("signupPassword").value,
    );

    if (accountType === "student") {
      formData.append(
        "regno",
        document.getElementById("signupRegno").value.trim(),
      );
    } else {
      formData.append(
        "club_description",
        document.getElementById("signupClubDesc").value.trim(),
      );
      formData.append(
        "club_category",
        document.getElementById("signupClubCategory").value,
      );
    }

    const res = await fetch(API_BASE, { method: "POST", body: formData });
    const data = await res.json();

    if (data.success) {
      if (accountType === "club") {
        showMessage(
          "Club account created! Awaiting admin approval.",
          "success",
        );
      } else {
        showMessage("Account created! Redirecting...", "success");
        setTimeout(() => {
          window.location.href = "index.html";
        }, 800);
      }
    } else {
      showMessage(data.error || "Signup failed");
    }
  } catch (err) {
    showMessage("Network error. Make sure WAMP is running.");
  }

  btn.disabled = false;
  btn.textContent = "Create Account";
});

// --- Check if already logged in ---
(async function checkSession() {
  try {
    const res = await fetch(API_BASE + "?action=check");
    const data = await res.json();
    if (data.loggedIn) {
      window.location.href = "index.html";
    }
  } catch (e) {
    // Not connected to server — stay on login page
  }
})();
