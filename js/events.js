// ============================================
// Campus360 — Events JS (events.html)
// ============================================

const AUTH_API = "php/auth.php";
const EVENTS_API = "php/events_api.php";
const UPLOAD_API = "php/upload.php";

let currentUser = null;
let currentPage = 1;
let activeCategory = "all";
let activeStatus = "upcoming";
let selectedPoster = null;

// ===== AUTH CHECK =====
(async () => {
  try {
    const res = await fetch(AUTH_API + "?action=check");
    const data = await res.json();
    if (!data.loggedIn) throw "no";
    currentUser = data.user;
    document.getElementById("userName").textContent = currentUser.name;

    // Show event composer for club accounts
    if (currentUser.account_type === "club") {
      document.getElementById("eventComposer").classList.add("visible");
    }

    loadEvents();
    loadClubDirectory();
  } catch (e) {
    window.location.href = "login.html";
  }
})();

// ===== LOGOUT =====
document.getElementById("logoutBtn").addEventListener("click", async () => {
  await fetch(AUTH_API + "?action=logout");
  window.location.href = "login.html";
});

// ===== LOAD EVENTS =====
async function loadEvents(page = 1) {
  try {
    let url =
      EVENTS_API + `?action=get_events&page=${page}&status=${activeStatus}`;
    if (activeCategory !== "all") url += `&category=${activeCategory}`;

    const res = await fetch(url);
    const data = await res.json();
    if (!data.success) return;

    const container = document.getElementById("eventsContainer");
    if (page === 1) container.innerHTML = "";

    if (data.events.length === 0 && page === 1) {
      container.innerHTML = `
        <div class="card">
          <div class="empty-state">
            <div class="empty-state-icon">📅</div>
            No events found
          </div>
        </div>`;
      document.getElementById("loadMoreBtn").style.display = "none";
      return;
    }

    data.events.forEach((ev) => {
      container.appendChild(createEventCard(ev));
    });

    document.getElementById("loadMoreBtn").style.display =
      data.events.length >= 20 ? "block" : "none";
    currentPage = page;
  } catch (e) {
    console.error("loadEvents error:", e);
  }
}

function loadMoreEvents() {
  loadEvents(currentPage + 1);
}

// ===== CREATE EVENT CARD =====
function createEventCard(ev) {
  const card = document.createElement("div");
  card.className = "card event-card";
  card.id = "event-" + ev.id;

  const initial = ev.club_name ? ev.club_name.charAt(0).toUpperCase() : "?";

  // Format Date Range
  let dateStr = formatDate(ev.event_date);
  if (ev.event_date_end && ev.event_date_end !== ev.event_date) {
    // If different year, show full dates. If same year, maybe shorten?
    // For now, simple range: "Mar 1, 2026 – Mar 3, 2026"
    dateStr += " – " + formatDate(ev.event_date_end);
  }
  const timeStr =
    formatTime12(ev.event_time_start) +
    (ev.event_time_end ? " – " + formatTime12(ev.event_time_end) : "");

  let posterHtml = "";
  if (ev.poster_path) {
    posterHtml = `<img src="${escHtml(ev.poster_path)}" class="event-poster" alt="Event poster" />`;
  }

  let badgesHtml = "";
  if (ev.od_provided == 1) {
    let odTime = "";
    if (ev.od_time_start && ev.od_time_end) {
      odTime = ` ${formatTime12(ev.od_time_start)} – ${formatTime12(ev.od_time_end)}`;
    }
    badgesHtml += `<span class="badge badge-od">🎫 OD${odTime}</span>`;
  }
  if (ev.club_category) {
    const catEmoji = {
      tech: "💻",
      cultural: "🎭",
      sports: "🏆",
      social: "🤝",
      academic: "📚",
      other: "📌",
    };
    badgesHtml += `<span class="badge badge-category">${catEmoji[ev.club_category] || "📌"} ${ev.club_category}</span>`;
  }
  if (ev.status === "cancelled") {
    badgesHtml += `<span class="badge badge-cancelled">❌ Cancelled</span>`;
  }

  let capacityHtml = "";
  if (ev.max_capacity) {
    const going = parseInt(ev.going_count) || 0;
    const pct = Math.min(100, Math.round((going / ev.max_capacity) * 100));
    const isFull = going >= ev.max_capacity;
    capacityHtml = `
      <div class="capacity-bar-wrap">
        <div class="capacity-bar-label">${going} / ${ev.max_capacity} going ${isFull ? '<span class="badge badge-full">FULL</span>' : ""}</div>
        <div class="capacity-bar"><div class="capacity-bar-fill ${isFull ? "full" : ""}" style="width:${pct}%"></div></div>
      </div>`;
  }

  const intActive = ev.my_rsvp === "interested" ? " active" : "";
  const goActive = ev.my_rsvp === "going" ? " active" : "";

  let actionsHtml = "";
  if (ev.status !== "cancelled") {
    actionsHtml = `
      <div class="event-actions">
        <button class="rsvp-btn interested${intActive}" onclick="toggleRSVP(${ev.id}, 'interested', this)">
          ⭐ Interested <span class="rsvp-count">${ev.interested_count || 0}</span>
        </button>
        <button class="rsvp-btn going${goActive}" onclick="toggleRSVP(${ev.id}, 'going', this)">
          ✅ Going <span class="rsvp-count">${ev.going_count || 0}</span>
        </button>
        ${ev.registration_link ? `<a href="${escHtml(ev.registration_link)}" target="_blank" class="event-reg-link">Register →</a>` : ""}
      </div>`;
  }

  // Club-only: cancel button
  let clubActionsHtml = "";
  if (
    currentUser &&
    currentUser.account_type === "club" &&
    ev.club_id == currentUser.id &&
    ev.status === "upcoming"
  ) {
    clubActionsHtml = `
      <div style="margin-top:0.4rem; text-align:right;">
        <button onclick="cancelEvent(${ev.id})" style="background:none; border:none; color:rgba(255,255,255,0.25); font-size:0.75rem; cursor:pointer; font-family:inherit;">Cancel this event</button>
      </div>`;
  }

  card.innerHTML = `
    ${posterHtml}
    <div class="event-header">
      <div class="event-club-avatar">${initial}</div>
      <div>
        <div class="event-title">${escHtml(ev.title)}</div>
        <div class="event-club-name">${escHtml(ev.club_name)}</div>
      </div>
    </div>
    <div class="event-meta">
      <div class="event-meta-item"><span class="event-meta-icon">📅</span>${dateStr}</div>
      <div class="event-meta-item"><span class="event-meta-icon">🕐</span>${timeStr}</div>
      ${ev.venue ? `<div class="event-meta-item"><span class="event-meta-icon">📍</span>${escHtml(ev.venue)}</div>` : ""}
    </div>
    ${badgesHtml ? `<div style="display:flex; flex-wrap:wrap; gap:0.4rem; margin-bottom:0.4rem;">${badgesHtml}</div>` : ""}
    ${ev.description ? `<div class="event-description">${escHtml(ev.description)}</div>` : ""}
    ${capacityHtml}
    ${actionsHtml}
    ${clubActionsHtml}
  `;

  return card;
}

// ===== TOGGLE RSVP =====
async function toggleRSVP(eventId, status, btn) {
  try {
    const isActive = btn.classList.contains("active");
    const newStatus = isActive ? "remove" : status;

    const formData = new FormData();
    formData.append("action", "rsvp");
    formData.append("event_id", eventId);
    formData.append("status", newStatus);

    const res = await fetch(EVENTS_API, { method: "POST", body: formData });
    const data = await res.json();

    if (!data.success) {
      showToast(data.error || "RSVP failed");
      return;
    }

    // Reload the event feed to get updated counts
    loadEvents(1);
    showToast(newStatus === "remove" ? "RSVP removed" : `Marked as ${status}!`);
  } catch (e) {
    showToast("Error updating RSVP");
  }
}

// ===== CANCEL EVENT =====
async function cancelEvent(eventId) {
  if (!confirm("Are you sure you want to cancel this event?")) return;

  const formData = new FormData();
  formData.append("action", "cancel_event");
  formData.append("event_id", eventId);

  try {
    const res = await fetch(EVENTS_API, { method: "POST", body: formData });
    const data = await res.json();
    if (data.success) {
      showToast("Event cancelled");
      loadEvents(1);
    } else {
      showToast(data.error || "Failed to cancel");
    }
  } catch (e) {
    showToast("Error cancelling event");
  }
}

// Make it globally available
window.createEvent = createEvent;

// Bind immediately (script is at end of body)
const createBtn = document.getElementById("createEventBtn");
if (createBtn) {
  console.log("Create button found, attaching listener");
  createBtn.addEventListener("click", (e) => {
    e.preventDefault();
    console.log("Button clicked via listener");
    createEvent();
  });
} else {
  console.error("CRITICAL: Create button NOT found in DOM");
}

async function createEvent() {
  console.log("createEvent called");
  alert("Debug: Starting creation...");
  const title = document.getElementById("eventTitle").value.trim();
  const desc = document.getElementById("eventDesc").value.trim();
  const date = document.getElementById("eventDate").value;
  const dateEnd = document.getElementById("eventDateEnd").value;
  const timeStart = document.getElementById("eventTimeStart").value;
  const timeEnd = document.getElementById("eventTimeEnd").value;
  const venue = document.getElementById("eventVenue").value.trim();
  const regLink = document.getElementById("eventRegLink").value.trim();
  const maxCap = document.getElementById("eventMaxCap").value;
  const odChecked = document.getElementById("odCheckbox").checked;
  const odStart = document.getElementById("odTimeStart").value;
  const odEnd = document.getElementById("odTimeEnd").value;

  if (!title || !date || !timeStart) {
    showToast("Title, start date, and start time are required");
    return;
  }

  if (dateEnd && dateEnd < date) {
    showToast("End date cannot be before start date");
    return;
  }

  const btn = document.getElementById("createEventBtn");
  btn.disabled = true;

  try {
    // Upload poster if selected
    let posterPath = null;
    if (selectedPoster) {
      const uploadData = new FormData();
      uploadData.append("file", selectedPoster);
      uploadData.append("type", "image");
      const uploadRes = await fetch(UPLOAD_API, {
        method: "POST",
        body: uploadData,
      });
      const uploadJson = await uploadRes.json();
      if (uploadJson.success) {
        posterPath = uploadJson.path;
      }
    }

    const formData = new FormData();
    formData.append("action", "create_event");
    formData.append("title", title);
    formData.append("description", desc);
    formData.append("event_date", date);
    if (dateEnd) formData.append("event_date_end", dateEnd);
    formData.append("event_time_start", timeStart);
    if (timeEnd) formData.append("event_time_end", timeEnd);
    formData.append("venue", venue);
    if (regLink) formData.append("registration_link", regLink);
    if (maxCap) formData.append("max_capacity", maxCap);
    if (posterPath) formData.append("poster_path", posterPath);
    formData.append("od_provided", odChecked ? "1" : "0");
    if (odChecked && odStart) formData.append("od_time_start", odStart);
    if (odChecked && odEnd) formData.append("od_time_end", odEnd);

    const res = await fetch(EVENTS_API, { method: "POST", body: formData });
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (err) {
      console.error("Server response:", text);
      throw new Error("Server Error: " + text.substring(0, 100) + "...");
    }

    if (data.success) {
      showToast("Event created! 🎉");
      // Reset form
      document.getElementById("eventTitle").value = "";
      document.getElementById("eventDesc").value = "";
      document.getElementById("eventDate").value = "";
      document.getElementById("eventDateEnd").value = "";
      document.getElementById("eventTimeStart").value = "";
      document.getElementById("eventTimeEnd").value = "";
      document.getElementById("eventVenue").value = "";
      document.getElementById("eventRegLink").value = "";
      document.getElementById("eventMaxCap").value = "";
      document.getElementById("odCheckbox").checked = false;
      document.getElementById("odTimeStart").value = "";
      document.getElementById("odTimeEnd").value = "";
      document.getElementById("posterFileName").textContent = "";
      selectedPoster = null;
      toggleOdFields();
      loadEvents(1);
      // Close modal/overlay if any
      document.getElementById("eventComposer").classList.remove("visible");
    } else {
      // Check for specific DB error requiring migration
      if (
        data.error &&
        data.error.includes("Unknown column 'event_date_end'")
      ) {
        if (
          confirm(
            "Database Update Required: The 'End Date' feature needs a database change. Update now?",
          )
        ) {
          try {
            const migRes = await fetch("php/migrate_events.php");
            const migText = await migRes.text();
            alert("Database Update Result:\n" + migText);
            showToast("Database updated! Try creating event again.");
          } catch (migErr) {
            alert("Failed to run migration: " + migErr);
          }
        }
      } else {
        showToast(data.error || "Failed to create event");
      }
    }
  } catch (e) {
    console.error("createEvent error:", e);
    // Show the actual error to the user for debugging
    showToast("Error: " + (e.message || e));
    alert("Create Event Error:\n" + (e.stack || e));
  } finally {
    btn.disabled = false;
  }
}

// ===== POSTER ATTACH =====
document.getElementById("posterAttachBtn").addEventListener("click", () => {
  document.getElementById("posterInput").click();
});

document.getElementById("posterInput").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) {
    selectedPoster = file;
    document.getElementById("posterFileName").textContent = file.name;
  }
});

// ===== OD TOGGLE =====
function toggleOdFields() {
  const checked = document.getElementById("odCheckbox").checked;
  document.getElementById("odFields").classList.toggle("visible", checked);
}

// ===== FILTERS =====
function filterCategory(cat, btn) {
  currentPage = 1;
  const allBtns = document.querySelectorAll("#categoryFilters .filter-btn");

  // If clicking the already-active category, reset to 'all'
  if (activeCategory === cat && cat !== "all") {
    activeCategory = "all";
    allBtns.forEach((b) => b.classList.remove("active"));
    // Mark the 'All' button as active
    allBtns.forEach((b) => {
      if (b.textContent.trim().replace(/^.\s*/, "") === "All")
        b.classList.add("active");
    });
  } else {
    activeCategory = cat;
    allBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
  }
  loadEvents(1);
}

function filterStatus(status, btn) {
  activeStatus = status;
  currentPage = 1;
  // Update status filter buttons
  const statusGroup = btn.parentElement;
  statusGroup
    .querySelectorAll(".filter-btn")
    .forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  loadEvents(1);
}

// ===== CLUB DIRECTORY =====
async function loadClubDirectory() {
  try {
    const res = await fetch(EVENTS_API + "?action=get_clubs");
    const data = await res.json();
    if (!data.success) return;

    const container = document.getElementById("clubDirectory");

    if (data.clubs.length === 0) {
      container.innerHTML =
        '<div class="empty-state" style="padding:0.5rem;">No clubs yet</div>';
      return;
    }

    container.innerHTML = data.clubs
      .map((club) => {
        const initial = club.name.charAt(0).toUpperCase();
        const catEmoji = {
          tech: "💻",
          cultural: "🎭",
          sports: "🏆",
          social: "🤝",
          academic: "📚",
          other: "📌",
        };
        const emoji = catEmoji[club.category] || "📌";
        const btnClass = club.is_following ? "following" : "follow";
        const btnText = club.is_following ? "Following" : "Follow";

        return `
        <div class="club-item">
          <div class="club-avatar">${initial}</div>
          <div class="club-info">
            <div class="club-name">${escHtml(club.name)}</div>
            <div class="club-meta">${emoji} ${club.category || "club"} · ${club.follower_count} followers · ${club.upcoming_events} upcoming</div>
          </div>
          <button class="follow-club-btn ${btnClass}" onclick="toggleFollowClub(${club.id}, this)">
            ${btnText}
          </button>
        </div>`;
      })
      .join("");
  } catch (e) {
    console.error("loadClubDirectory error:", e);
  }
}

// ===== FOLLOW / UNFOLLOW CLUB =====
async function toggleFollowClub(clubId, btn) {
  try {
    const formData = new FormData();
    formData.append("action", "follow_club");
    formData.append("club_id", clubId);

    const res = await fetch(EVENTS_API, { method: "POST", body: formData });
    const data = await res.json();

    if (data.success) {
      if (data.action === "followed") {
        btn.className = "follow-club-btn following";
        btn.textContent = "Following";
        showToast("Following club!");
      } else {
        btn.className = "follow-club-btn follow";
        btn.textContent = "Follow";
        showToast("Unfollowed club");
      }
    }
  } catch (e) {
    showToast("Error updating follow");
  }
}

// ===== UTILITIES =====
function escHtml(str) {
  if (!str) return "";
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function formatTime12(timeStr) {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":");
  const hour = parseInt(h);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2500);
}
