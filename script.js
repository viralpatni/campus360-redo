document.addEventListener("DOMContentLoaded", () => {
  // 1. Initialize Icons
  lucide.createIcons();

  // 0. Logout functionality
  const logoutLink = document.getElementById("navAuthLink");
  if (logoutLink) {
    logoutLink.addEventListener("click", async function (e) {
      e.preventDefault();
      try {
        const res = await fetch("php/auth.php?action=logout", { method: "POST" });
        const data = await res.json();
        if (data.success) {
          // Remove any user info from localStorage if used
          localStorage.removeItem("user");
          window.location.href = "login.html";
        } else {
          alert("Logout failed. Please try again.");
        }
      } catch (err) {
        alert("Network error during logout.");
      }
    });
  }

  // 2. Horizontal Drag-to-Scroll for Marketplace
  const marketScroll = document.getElementById('marketScroll');
  if(marketScroll) {
    let isDown = false;
    let startX;
    let scrollLeft;

    marketScroll.addEventListener('mousedown', (e) => {
      isDown = true;
      marketScroll.style.cursor = 'grabbing';
      startX = e.pageX - marketScroll.offsetLeft;
      scrollLeft = marketScroll.scrollLeft;
    });
    marketScroll.addEventListener('mouseleave', () => {
      isDown = false;
      marketScroll.style.cursor = 'grab';
    });
    marketScroll.addEventListener('mouseup', () => {
      isDown = false;
      marketScroll.style.cursor = 'grab';
    });
    marketScroll.addEventListener('mousemove', (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - marketScroll.offsetLeft;
      const walk = (x - startX) * 2; // Scroll-fast multiplier
      marketScroll.scrollLeft = scrollLeft - walk;
    });
  }

  // 3. Theme Toggle (Dark / Light Mode)
  const darkModeToggle = document.getElementById("darkModeToggle");
  const themeIcon = document.getElementById("themeIcon");

  function updateThemeIcon() {
    const isDark = document.body.classList.contains("dark-mode");
    themeIcon.setAttribute("data-lucide", isDark ? "sun" : "moon");
    lucide.createIcons({ nameAttr: 'data-lucide' });
  }

  // Check saved theme or system preference
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "dark") {
    document.body.classList.add("dark-mode");
  } else if (savedTheme === "light") {
    document.body.classList.remove("dark-mode");
  } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.body.classList.add("dark-mode");
  }
  
  updateThemeIcon();

  if (darkModeToggle) {
    darkModeToggle.addEventListener("click", () => {
      document.body.classList.toggle("dark-mode");
      
      if (document.body.classList.contains("dark-mode")) {
        localStorage.setItem("theme", "dark");
      } else {
        localStorage.setItem("theme", "light");
      }
      
      updateThemeIcon();
    });
  }
});