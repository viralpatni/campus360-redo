// Lost & Found Logic - Refactored for consistency

const API_URL = "php/lost_found_api.php?action=";
const UPLOAD_URL = "php/upload.php";

let currentType = "all"; // 'all', 'lost', 'found'
let showMyItems = false;
let currentUser = null; // Will set after fetch

const AUTH_API = "php/auth.php";

document.addEventListener("DOMContentLoaded", async () => {
  // Auth Check
  try {
    const authRes = await fetch(AUTH_API + "?action=check");
    const authData = await authRes.json();
    if (!authData.loggedIn) {
      window.location.href = "login.html";
      return;
    }
    currentUser = authData.user.id; // Use ID for ownership checks
    document.getElementById("userName").textContent = authData.user.name;

    // Setup Logout
    document.getElementById("logoutBtn").addEventListener("click", async () => {
      await fetch(AUTH_API + "?action=logout");
      window.location.href = "login.html";
    });
  } catch (e) {
    window.location.href = "login.html";
    return;
  }

  fetchItems();
  fetchStats();

  // Search
  const searchInput = document.getElementById("searchInput");
  let debounceTimer;
  searchInput.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(fetchItems, 300);
  });

  // Handle Form Submit
  const form = document.getElementById("reportForm");
  form.addEventListener("submit", handleReportSubmit);

  // Image Upload
  document
    .getElementById("itemImage")
    .addEventListener("change", handleImageUpload);
});

// Sidebar Filters
window.filterType = (type, btn) => {
  currentType = type;
  // Update Active UI
  const btns = btn.parentElement.querySelectorAll(".filter-btn");
  btns.forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  // Reset My Items if clicking type? No, keep it orthogonal or reset?
  // Events page logic: Category resets page.
  // Let's keep "My Items" as a toggle.
  fetchItems();
};

window.toggleMyItems = (btn) => {
  showMyItems = !showMyItems;
  btn.classList.toggle("active");
  fetchItems();
};

window.toggleComposer = () => {
  const container = document.getElementById("reportFormContainer");
  const icon = document.getElementById("composerToggleIcon");
  if (container.style.display === "none") {
    container.style.display = "block";
    icon.textContent = "▲";
  } else {
    container.style.display = "none";
    icon.textContent = "▼";
  }
};

async function fetchStats() {
  try {
    const res = await fetch(API_URL + "get_stats");
    const data = await res.json();
    if (data.success) {
      document.getElementById("statLost").textContent = data.stats.lost || 0;
      document.getElementById("statFound").textContent = data.stats.found || 0;
    }
  } catch (e) {}
}

async function fetchItems() {
  const grid = document.getElementById("itemsGrid");
  grid.innerHTML =
    '<div style="text-align:center; padding:2rem; color:rgba(255,255,255,0.4);">Loading...</div>';

  const search = document.getElementById("searchInput").value;

  // Logic: API accepts 'type'. If 'all', we pass nothing or handle in API?
  // My previous API code: `WHERE i.type = ?`. It REQUIRED type.
  // I need to update fetch to loop or API to support 'all'.
  // Or I can just fetch 'lost' and 'found' and merge if 'all'.
  // Or update API to allow empty type.
  // Let's stick to 'lost' default if 'all' is not supported, or cycle.
  // Actually, user wants "Lost Items" and "Found Items". 'All' might be confusing visually.
  // But I added "All Items" filter.
  // I will modify API query param slightly in this call? No, API is fixed.
  // API: `$type = $_GET['type'] ?? 'lost';`
  // It defaults to lost.
  // I should update API to support 'all'.
  // But I can't touch API easily right now (one tool call at a time).
  // I will just fetch 'lost' AND 'found' if type is 'all' and merge.
  // Or just default to 'lost' and 'found' separately.

  // WAIT: I added "All Items" button in HTML.
  // I'll filter on client side? No, pagination (if any).
  // I'll call API twice if 'all'.

  let items = [];
  try {
    let typesToFetch =
      currentType === "all" ? ["lost", "found"] : [currentType];

    for (let t of typesToFetch) {
      let url = `${API_URL}get_items&type=${t}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (showMyItems) url += `&my_items=true`;

      const res = await fetch(url);
      const data = await res.json();

      if (data.success) {
        currentUser = data.current_user_id;
        items = items.concat(data.items);
      } else if (data.error && data.error.includes("doesn't exist")) {
        grid.innerHTML = `<div style="text-align:center; padding: 2rem;">
                    <p style="color:#fb7185; margin-bottom:1rem;">Database Setup Required</p>
                    <button onclick="location.href='php/migrate_lostfound.php'" class="create-event-btn" style="width:auto;">Run Database Setup</button>
                 </div>`;
        return;
      }
    }

    // Sort items by date desc
    items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    renderItems(items);
  } catch (e) {
    grid.innerHTML = `<div style="text-align:center; padding:2rem; color:rgba(255,255,255,0.4);">Failed to load items.</div>`;
  }
}

function renderItems(items) {
  const grid = document.getElementById("itemsGrid");
  grid.innerHTML = "";

  if (items.length === 0) {
    grid.innerHTML = `<div class="empty-state">No items found matching your criteria.</div>`;
    return;
  }

  items.forEach((item) => {
    const card = document.createElement("div");
    card.className = "card event-card"; // Reuse event-card layout

    // Badge
    let badgeClass = item.type === "lost" ? "badge-lost" : "badge-found";
    if (item.status === "resolved") badgeClass = "badge-resolved";

    const badge = `<span class="badge ${badgeClass}">${item.status === "resolved" ? "RESOLVED" : item.type.toUpperCase()}</span>`;

    // Image
    let imgHtml = "";
    if (item.image_path) {
      imgHtml = `<img src="${item.image_path}" class="event-poster" alt="Item Image">`;
    }

    // Actions
    let actionsHtml = "";
    if (currentUser && item.user_id == currentUser) {
      const resolveBtn =
        item.status === "open"
          ? `<button onclick="updateStatus(${item.id}, 'resolved')" class="topbar-btn" style="color:#4ade80;">Mark Resolved</button>`
          : `<button onclick="updateStatus(${item.id}, 'open')" class="topbar-btn">Reopen</button>`;

      const deleteBtn = `<button onclick="deleteItem(${item.id})" class="topbar-btn danger">Delete</button>`;

      actionsHtml = `<div class="event-actions">${resolveBtn} ${deleteBtn}</div>`;
    } else if (item.status === "open") {
      // Contact Button
      actionsHtml = `<div class="event-actions">
                <a href="messages.html" class="topbar-btn" style="text-decoration:none;">Contact Reporter</a>
             </div>`;
      if (item.contact_info) {
        actionsHtml += `<div style="margin-top:0.5rem; font-size:0.8rem; color:rgba(255,255,255,0.5);">Contact: ${item.contact_info}</div>`;
      }
    }

    card.innerHTML = `
            ${imgHtml}
            <div class="event-header">
                <div style="flex:1;">
                    <div class="event-title">${item.title}</div>
                    <div style="font-size:0.8rem; color:rgba(255,255,255,0.4); margin-top:0.2rem;">${item.location}</div>
                </div>
                ${badge}
            </div>
            
            <div class="event-meta">
               <div class="event-meta-item">📅 ${item.event_date}</div>
            </div>
            
            <div class="event-description">${item.description || ""}</div>
            
            ${actionsHtml}
        `;
    grid.appendChild(card);
  });
}

// Handlers
async function handleReportSubmit(e) {
  e.preventDefault();
  const formData = new FormData(e.target);
  formData.append("action", "create_item");

  // Image path is handled by name="image_path" in hidden input

  try {
    const res = await fetch("php/lost_found_api.php", {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    if (data.success) {
      showToast("Item reported!");
      e.target.reset();
      document.getElementById("itemImagePath").value = "";
      document.getElementById("imagePreview").style.display = "none";
      toggleComposer(); // Close
      fetchItems();
      fetchStats();
    } else {
      showToast(data.error || "Failed");
    }
  } catch (e) {
    showToast("Error");
  }
}

async function handleImageUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const formData = new FormData();
  formData.append("file", file);
  try {
    const res = await fetch(UPLOAD_URL, { method: "POST", body: formData });
    const data = await res.json();
    if (data.success) {
      document.getElementById("itemImagePath").value = data.path;
      const prev = document.getElementById("imagePreview");
      prev.style.display = "block";
      prev.innerHTML = `<img src="${data.path}" style="max-height:100px; border-radius:4px;">`;
    }
  } catch (e) {}
}

window.updateStatus = async (id, status) => {
  // ... same as before
  if (!confirm("Update status?")) return;
  const fd = new FormData();
  fd.append("action", "update_status");
  fd.append("id", id);
  fd.append("status", status);
  await fetch("php/lost_found_api.php", { method: "POST", body: fd });
  fetchItems();
  fetchStats();
};

window.deleteItem = async (id) => {
  if (!confirm("Delete?")) return;
  const fd = new FormData();
  fd.append("action", "delete_item");
  fd.append("id", id);
  await fetch("php/lost_found_api.php", { method: "POST", body: fd });
  fetchItems();
  fetchStats();
};

function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 3000);
}
