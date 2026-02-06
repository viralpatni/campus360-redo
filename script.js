/* ===== REQUIRED BY MAAM ===== */

// USER NAME + VISIT COUNTER
let name = localStorage.getItem("name");
let visits = localStorage.getItem("visits");

if (!name) {
  name = prompt("Enter your name:");
  localStorage.setItem("name", name);
  visits = 1;
} else {
  visits = Number(visits) + 1;
}

localStorage.setItem("visits", visits);

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("userGreeting").innerText =
    "Welcome " + name + " | Visits: " + visits;
});

// HERO BACKGROUND IMAGE SLIDESHOW - INFINITE LOOP
let images = ["img1.jpg", "img2.jpg", "img3.jpg", "img4.jpg"];
let currentIndex = 0;

document.addEventListener("DOMContentLoaded", () => {
  const slideshow = document.getElementById("heroBgSlideshow");

  // Create background image slides
  images.forEach((img, index) => {
    const slide = document.createElement("div");
    slide.className = `hero-bg-slide ${index === 0 ? "active" : ""}`;
    slide.style.backgroundImage = `url('${img}')`;
    slideshow.appendChild(slide);
  });

  // Auto-advance slideshow every 4 seconds
  setInterval(nextSlide, 4000);
});

function updateSlideshow() {
  const slides = document.querySelectorAll(".hero-bg-slide");

  slides.forEach((slide, index) => {
    slide.classList.remove("active");
    if (index === currentIndex) {
      slide.classList.add("active");
    }
  });
}

function nextSlide() {
  currentIndex = (currentIndex + 1) % images.length;
  updateSlideshow();
}

/* ============================ */

const externalLinks = {
  vtop: "https://vtopcc.vit.ac.in",
  vitiancc: "https://chennai.vit.ac.in",
  testimonials: "testimonials.example.com",
  // Add more links here as needed
  forum: "https://forum.example.com",
  events: "https://chennaievents.vit.ac.in",
  lostAndFound: "https://lostandfound.example.com",
  internships: "https://internships.example.com",
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
      window.open(url, "_blank");
    });

    // Keyboard accessibility (Enter key)
    element.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        window.open(url, "_blank");
      }
    });
  }
})();
