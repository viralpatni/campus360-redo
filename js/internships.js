// ============================================
// Campus360 — Internships Page Logic
// B.Tech Undergraduate Focus
// ============================================

(function () {
  "use strict";

  // --- DOM Elements ---
  const grid = document.getElementById("internGrid");
  const searchInput = document.getElementById("internSearch");
  const refreshBtn = document.getElementById("refreshBtn");
  const statsBar = document.getElementById("internStats");
  const resultCount = document.getElementById("resultCount");
  const cachedBadge = document.getElementById("cachedBadge");
  const lastUpdated = document.getElementById("lastUpdated");
  const filterChips = document.querySelectorAll(".intern-filter-chip");

  // --- State ---
  let allInternships = [];
  let currentSource = "all";
  let currentCategory = "";
  let currentQuery = "";
  let isLoading = false;

  // --- API URL ---
  const API_BASE = "php/internships_api.php";

  // --- Category keyword maps for client-side filtering ---
  const categoryKeywords = {
    cs: [
      "computer science",
      "software",
      "web development",
      "full stack",
      "frontend",
      "backend",
      "python",
      "java",
      "javascript",
      "node",
      "react",
      "angular",
      "django",
      "mobile app",
      "android",
      "ios",
      "flutter",
      "devops",
      "cloud",
      "cs",
      "it",
      "programming",
      "coding",
      "php",
      "wordpress",
      "cyber security",
      "game development",
    ],
    ece: [
      "electronics",
      "electrical",
      "embedded",
      "vlsi",
      "iot",
      "communication",
      "signal",
      "circuit",
      "pcb",
      "microcontroller",
      "arduino",
      "raspberry",
      "ece",
      "eee",
      "power",
      "robotics",
      "mechatronics",
      "drone",
      "hardware",
    ],
    mech: [
      "mechanical",
      "manufacturing",
      "automobile",
      "automotive",
      "cad",
      "cam",
      "solidworks",
      "autocad",
      "thermal",
      "hvac",
      "robotics",
      "mechatronics",
      "3d printing",
      "prototype",
      "production",
      "industrial",
    ],
    data: [
      "data science",
      "data analyst",
      "machine learning",
      "artificial intelligence",
      "ai",
      "ml",
      "deep learning",
      "nlp",
      "big data",
      "analytics",
      "statistics",
      "data engineering",
      "tableau",
      "power bi",
      "neural",
      "computer vision",
    ],
  };

  // --- Init ---
  document.addEventListener("DOMContentLoaded", () => {
    fetchInternships();
    setupListeners();
  });

  function setupListeners() {
    // Search input
    let searchTimeout;
    searchInput.addEventListener("input", (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        currentQuery = e.target.value.trim().toLowerCase();
        renderCards();
      }, 250);
    });

    // Filter chips (source + category)
    filterChips.forEach((chip) => {
      chip.addEventListener("click", () => {
        if (chip.dataset.source !== undefined) {
          // Source filter — deactivate other source chips
          filterChips.forEach((c) => {
            if (c.dataset.source !== undefined) c.classList.remove("active");
          });
          chip.classList.add("active");
          currentSource = chip.dataset.source;
        } else if (chip.dataset.category !== undefined) {
          // Category filter — toggle
          if (chip.classList.contains("active")) {
            chip.classList.remove("active");
            currentCategory = "";
          } else {
            filterChips.forEach((c) => {
              if (c.dataset.category !== undefined)
                c.classList.remove("active");
            });
            chip.classList.add("active");
            currentCategory = chip.dataset.category;
          }
        }
        renderCards();
      });
    });

    // Refresh button
    refreshBtn.addEventListener("click", () => {
      if (!isLoading) {
        fetchInternships(true);
      }
    });
  }

  // --- Fetch from API ---
  async function fetchInternships(forceRefresh = false) {
    isLoading = true;
    refreshBtn.classList.add("loading");
    showSkeletons();

    try {
      if (forceRefresh) {
        try {
          const refreshRes = await fetch(`${API_BASE}?action=refresh&source=all`);
          const refreshData = await refreshRes.json();
          if (refreshData.message) console.log("Refresh:", refreshData.message);
        } catch(e) { console.error("Refresh trigger failed:", e); }
      }

      const url = `${API_BASE}?action=fetch&limit=200&source=all`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.success !== false && data.internships) {
        allInternships = data.internships;

        // Update stats
        statsBar.style.display = "flex";
        if (data.cached) {
          cachedBadge.style.display = "inline-block";
        } else {
          cachedBadge.style.display = "none";
        }

        if (data.timestamp) {
          const date = new Date(data.timestamp * 1000);
          lastUpdated.textContent = "Updated: " + date.toLocaleTimeString();
        }

        renderCards();
      } else {
        showError(data.error || "Failed to load internships");
      }
    } catch (err) {
      console.error("Fetch error:", err);
      // If PHP is not running, use the live data scraped by the Python script
      if (window.LIVE_INTERNSHIPS && window.LIVE_INTERNSHIPS.internships) {
        allInternships = window.LIVE_INTERNSHIPS.internships;

        const date = new Date(window.LIVE_INTERNSHIPS.timestamp * 1000);
        lastUpdated.textContent =
          "Live data loaded from script: " + date.toLocaleTimeString();
      } else {
        showError(
          'No live data found. Please run "python scrape.py" to fetch latest internships.',
        );
      }
      statsBar.style.display = "flex";
      renderCards();
    } finally {
      isLoading = false;
      refreshBtn.classList.remove("loading");
    }
  }

  // --- Rendering ---
  function renderCards() {
    let filtered = allInternships;

    // Filter by source
    if (currentSource !== "all") {
      filtered = filtered.filter((item) => {
        const src = (item.source || "").toLowerCase();
        if (currentSource === "internshala") return src.includes("internshala");
        if (currentSource === "unstop") return src.includes("unstop");
        return true;
      });
    }

    // Filter by B.Tech category
    if (currentCategory && categoryKeywords[currentCategory]) {
      const keywords = categoryKeywords[currentCategory];
      filtered = filtered.filter((item) => {
        const searchable = [item.title, item.company, ...(item.tags || [])]
          .join(" ")
          .toLowerCase();
        return keywords.some((kw) => searchable.includes(kw));
      });
    }

    // Filter by search query
    if (currentQuery) {
      filtered = filtered.filter((item) => {
        const searchable = [
          item.title,
          item.company,
          item.location,
          item.stipend,
          item.duration,
          ...(item.tags || []),
        ]
          .join(" ")
          .toLowerCase();
        return searchable.includes(currentQuery);
      });
    }

    // Update count
    resultCount.textContent = filtered.length;

    // Clear grid
    grid.innerHTML = "";

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="intern-empty">
          <div class="intern-empty-icon">🔍</div>
          <h3>No internships found</h3>
          <p>${currentQuery ? "Try a different search term" : currentCategory ? "No internships in this branch. Try another filter." : "No data available. Click Refresh to try again."}</p>
        </div>
      `;
      return;
    }

    // Render cards with staggered animation
    filtered.forEach((item, index) => {
      const card = createCard(item, index);
      grid.appendChild(card);
    });
  }

  function createCard(item, index) {
    const card = document.createElement("div");
    card.className = "intern-card";
    card.style.animationDelay = `${Math.min(index * 0.05, 1)}s`;
    let sourceClass = "unknown";
    let sourceLabel = escapeHTML(item.source || "Unknown");
    const sourceLower = (item.source || "").toLowerCase();

    if (sourceLower.includes("internshala")) {
      sourceClass = "internshala";
      sourceLabel = "Internshala";
    } else if (sourceLower.includes("unstop")) {
      sourceClass = "unstop";
      sourceLabel = "Unstop";
    } else if (sourceLower.includes("indeed")) {
      sourceClass = "indeed";
      sourceLabel = "Indeed";
    }

    // Tags HTML
    const tagsHTML = (item.tags || [])
      .map((tag) => `<span class="intern-tag">${escapeHTML(tag)}</span>`)
      .join("");

    card.innerHTML = `
      <div class="intern-card-header">
        <div class="intern-card-title">${escapeHTML(item.title || "Untitled")}</div>
        <span class="intern-source-badge ${sourceClass}">${sourceLabel}</span>
      </div>
      <div class="intern-card-company">${escapeHTML(item.company || "Unknown Company")}</div>
      <div class="intern-card-meta">
        <span class="intern-meta-item">
          <span class="meta-icon">📍</span>
          ${escapeHTML(item.location || "Not specified")}
        </span>
        ${
          item.duration
            ? `
        <span class="intern-meta-item">
          <span class="meta-icon">⏱️</span>
          ${escapeHTML(item.duration)}
        </span>`
            : ""
        }
        ${
          item.start_date
            ? `
        <span class="intern-meta-item">
          <span class="meta-icon">📅</span>
          Start: ${escapeHTML(item.start_date)}
        </span>`
            : ""
        }
        ${
          item.target_batch
            ? `
        <span class="intern-meta-item" style="color:#6366f1;">
          <span class="meta-icon">🎓</span>
          ${escapeHTML(item.target_batch)}
        </span>`
            : ""
        }
        ${
          item.deadline
            ? `
        <span class="intern-meta-item" style="color:#ef4444;">
          <span class="meta-icon">⏳</span>
          Apply By: ${escapeHTML(item.deadline)}
        </span>`
            : ""
        }
      </div>
      ${tagsHTML ? `<div class="intern-card-tags">${tagsHTML}</div>` : ""}
      <div class="intern-card-footer">
        <span class="intern-stipend">${escapeHTML(item.stipend || "View on site")}</span>
        ${
          item.link
            ? `<a href="${escapeHTML(item.link)}" target="_blank" rel="noopener noreferrer" class="intern-view-btn">Apply →</a>`
            : ""
        }
      </div>
    `;

    return card;
  }

  // --- Loading skeletons ---
  function showSkeletons() {
    grid.innerHTML = "";
    for (let i = 0; i < 6; i++) {
      const skel = document.createElement("div");
      skel.className = "intern-skeleton";
      skel.innerHTML = `
        <div class="skeleton-line h-20 w-75"></div>
        <div class="skeleton-line w-50"></div>
        <div class="skeleton-line w-40"></div>
        <div class="skeleton-line w-30"></div>
      `;
      grid.appendChild(skel);
    }
  }

  // --- Error state ---
  function showError(message) {
    grid.innerHTML = `
      <div class="intern-error">
        <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">⚠️</div>
        <h3>Something went wrong</h3>
        <p>${escapeHTML(message)}</p>
        <p style="margin-top: 0.8rem; font-size: 0.85rem;">Make sure WAMP is running and try clicking <strong>Refresh</strong>.</p>
      </div>
    `;
  }

  // --- Helpers ---
  function escapeHTML(str) {
    if (!str) return "";
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }
})();
