// --- Scroll Reveal Animations ---
document.addEventListener("DOMContentLoaded", () => {
  const revealElements = document.querySelectorAll(".scroll-reveal");

  if ("IntersectionObserver" in window) {
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed");
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
    );

    revealElements.forEach((el) => revealObserver.observe(el));
  } else {
    // Fallback: reveal everything immediately
    revealElements.forEach((el) => el.classList.add("revealed"));
  }
});

// Mobile nav toggle + sticky nav scroll state
document.addEventListener("DOMContentLoaded", () => {
  const nav = document.getElementById("primaryNav");
  const navToggle = document.getElementById("navToggle");
  const navList = document.getElementById("primaryNavList");

  if (!nav || !navToggle || !navList) return;

  const closeMenu = () => {
    navList.classList.remove("open");
    navToggle.setAttribute("aria-expanded", "false");
  };

  navToggle.addEventListener("click", () => {
    const willOpen = !navList.classList.contains("open");
    navList.classList.toggle("open", willOpen);
    navToggle.setAttribute("aria-expanded", willOpen ? "true" : "false");
  });

  navList.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      if (window.innerWidth <= 700) {
        closeMenu();
      }
    });
  });

  document.addEventListener("click", (event) => {
    if (window.innerWidth <= 700 && !nav.contains(event.target)) {
      closeMenu();
    }
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 700) {
      closeMenu();
    }
  });

  const syncNavScrollState = () => {
    document.body.classList.toggle("nav-scrolled", window.scrollY > 24);
  };

  window.addEventListener("scroll", syncNavScrollState, { passive: true });
  syncNavScrollState();
});

const externalLinks = {
  vtop: "https://vtopcc.vit.ac.in",
  vitiancc: "https://chennai.vit.ac.in",
  testimonials: "#testimonials",
  // Add more links here as needed
  forum: "forum.html",
  events: "events.html",
  lostAndFound: "lost_found.html",
  internships: "internships.html",
  studyResources: "study_resources.html",
};

// Initialize external link redirects
(function () {
  document.addEventListener("DOMContentLoaded", function () {
    // Get all feature items
    const featureItems = document.querySelectorAll(".feature-item");

    featureItems.forEach((item) => {
      const title = item.querySelector("strong");
      if (!title) return;

      const titleText = title.textContent.toLowerCase();

      // VTOP Button
      if (titleText.includes("vtop")) {
        makeClickable(item, externalLinks.vtop, "Go to VTOP Portal");
      }

      // VITianCC Button
      if (titleText.includes("vitiancc")) {
        makeClickable(item, externalLinks.vitiancc, "Go to VITianCC");
      }

      // Internships
      if (titleText.includes("internship")) {
        makeClickable(item, externalLinks.internships, "Go to Internships");
      }

      // Forum
      if (titleText.includes("forum")) {
        makeClickable(item, externalLinks.forum, "Go to Forum");
      }

      // Events Corner
      if (titleText.includes("events")) {
        makeClickable(item, externalLinks.events, "Go to Events");
      }

      // Lost and Found
      if (titleText.includes("lost and found")) {
        makeClickable(item, externalLinks.lostAndFound, "Go to Lost and Found");
      }

      // Study Resources
      if (titleText.includes("study resources")) {
        makeClickable(
          item,
          externalLinks.studyResources,
          "Go to Study Resources",
        );
      }
    });

    // Testimonials section redirect
    const testimonialsSection = document.getElementById("testimonials");
    if (testimonialsSection) {
      makeClickable(
        testimonialsSection,
        externalLinks.testimonials,
        "View more testimonials",
      );
    }
  });

  // Helper function to make elements clickable with redirect
  function makeClickable(element, url, ariaLabel) {
    element.style.cursor = "pointer";
    element.setAttribute("role", "link");
    element.setAttribute("aria-label", ariaLabel);
    element.setAttribute("tabindex", "0");

    // Click handler
    element.addEventListener("click", function (e) {
      // Don't redirect if clicking on an existing link inside
      if (e.target.tagName === "A") return;
      if (url.startsWith("#")) {
        const target = document.querySelector(url);
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
        }
        return;
      }
      window.location.href = url;
    });

    // Keyboard accessibility (Enter key)
    element.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        if (url.startsWith("#")) {
          const target = document.querySelector(url);
          if (target) {
            target.scrollIntoView({ behavior: "smooth", block: "start" });
          }
          return;
        }
        window.location.href = url;
      }
    });
  }
})();

// Highlight active in-page nav link while scrolling
document.addEventListener("DOMContentLoaded", () => {
  const navLinks = Array.from(
    document.querySelectorAll('#primaryNav a[href^="#"]'),
  );
  const sections = navLinks
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);

  if (!sections.length || !navLinks.length) return;

  const setActiveLink = (id) => {
    navLinks.forEach((link) => {
      const isActive = link.getAttribute("href") === `#${id}`;
      link.classList.toggle("active", isActive);
      if (isActive) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  };

  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible?.target?.id) {
        setActiveLink(visible.target.id);
      }
    },
    {
      root: null,
      threshold: [0.2, 0.5, 0.8],
      rootMargin: "-80px 0px -45% 0px",
    },
  );

  sections.forEach((section) => observer.observe(section));
});
