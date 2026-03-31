// ============================================
// Campus360 Scraper — Internshala Source
// Scrapes B.Tech-relevant internship categories
// ============================================

const cheerio = require("cheerio");
const { fetchPage, sleep } = require("../http");

const SOURCE = "Internshala";

// B.Tech-relevant category URLs
const CATEGORY_URLS = [
  {
    url: "https://internshala.com/internships/computer-science-internship",
    category: "Computer Science",
  },
  {
    url: "https://internshala.com/internships/web-development-internship",
    category: "Web Development",
  },
  {
    url: "https://internshala.com/internships/data-science-internship",
    category: "Data Science",
  },
  {
    url: "https://internshala.com/internships/machine-learning-internship",
    category: "Machine Learning",
  },
  {
    url: "https://internshala.com/internships/artificial-intelligence-ai-internship",
    category: "Artificial Intelligence",
  },
  {
    url: "https://internshala.com/internships/python-django-development-internship",
    category: "Python/Django",
  },
  {
    url: "https://internshala.com/internships/mobile-app-development-internship",
    category: "Mobile Development",
  },
  {
    url: "https://internshala.com/internships/electronics-internship",
    category: "Electronics",
  },
  {
    url: "https://internshala.com/internships/electrical-engineering-internship",
    category: "Electrical Engineering",
  },
  {
    url: "https://internshala.com/internships/mechanical-engineering-internship",
    category: "Mechanical Engineering",
  },
  {
    url: "https://internshala.com/internships/civil-engineering-internship",
    category: "Civil Engineering",
  },
  {
    url: "https://internshala.com/internships/embedded-systems-internship",
    category: "Embedded Systems",
  },
];

/**
 * Parse internship listings from Internshala HTML
 */
function parseListings(html, category) {
  const $ = cheerio.load(html);
  const internships = [];

  // Internshala wraps each listing in .individual_internship or similar containers
  // Try multiple selectors as they change their markup
  const selectors = [
    ".individual_internship",
    ".internship_meta",
    '[class*="individual_internship"]',
  ];

  let $cards = $([]);
  for (const sel of selectors) {
    $cards = $(sel);
    if ($cards.length > 0) break;
  }

  if ($cards.length > 0) {
    $cards.each((_, el) => {
      const internship = parseCard($, el, category);
      if (internship) internships.push(internship);
    });
  }

  // Fallback: regex-based extraction if DOM parsing found nothing
  if (internships.length === 0) {
    const regexResults = parseWithRegex(html, category);
    internships.push(...regexResults);
  }

  return internships;
}

/**
 * Parse a single internship card from DOM
 */
function parseCard($, el, category) {
  const $card = $(el);

  // Title + Link
  const $titleLink = $card
    .find("h3 a, a.job-title-href, .job-internship-name a")
    .first();
  const title = $titleLink.text().trim();
  let link = $titleLink.attr("href") || "";

  if (!title) return null;

  if (link && !link.startsWith("http")) {
    link = "https://internshala.com" + link;
  }

  // Company
  const company =
    $card
      .find("p.company a, a.link_display_like_text, .company-name")
      .first()
      .text()
      .trim() ||
    $card.find("h4").first().text().trim() ||
    "Unknown";

  // Location
  const location =
    $card
      .find(
        ".location_link, .location a, #location_names a, .ic-16-map-pin + span",
      )
      .first()
      .text()
      .trim() || "Not specified";

  // Stipend
  const stipend = (
    $card
      .find(
        ".stipend, .ic-16-money + span, .stipend_container_toolbar_498 span",
      )
      .first()
      .text()
      .trim() || "Not disclosed"
  ).replace(/\s+/g, " ");

  // Duration
  const duration =
    $card
      .find(
        '.ic-16-calendar + span, .other_detail_item .item_body:contains("Months"), .other_detail_item .item_body:contains("Month")',
      )
      .first()
      .text()
      .trim() || "";

  // Start date
  const startDate =
    $card
      .find(".start_date, .ic-16-calendar + .item_body")
      .first()
      .text()
      .trim() || "";

  // Apply by / Deadline
  const applyBy =
    $card.find(".apply_by .item_body, .apply_by_date").first().text().trim() ||
    "";

  // Applicants
  const applicants =
    $card
      .find(".applications_message, .desktop .applications_message")
      .first()
      .text()
      .trim() || "";

  // Skills — Internshala sometimes shows required skills
  const skillsList = [];
  $card
    .find(".skills_container span, .skill, .round_tabs, .matching_tag")
    .each((_, skillEl) => {
      const skillText = $(skillEl).text().trim();
      if (
        skillText &&
        skillText.length < 50 &&
        !skillsList.includes(skillText)
      ) {
        skillsList.push(skillText);
      }
    });
  // Also infer skills from title/category
  const inferredSkills = inferSkillsFromTitle(title, category);
  for (const s of inferredSkills) {
    if (!skillsList.includes(s)) skillsList.push(s);
  }
  const skills = skillsList.join(", ");

  // Target batch — infer from current year
  const currentYear = new Date().getFullYear();
  const targetBatch = `${currentYear}, ${currentYear + 1} batch`;

  // Deadline — format the apply_by date into a more useful format
  const deadline = applyBy || "";

  // Tags
  const tags = ["B.Tech"];
  if (category) tags.push(category);

  $card.find(".status span, .tag, .labels_container span").each((_, tagEl) => {
    const tagText = $(tagEl).text().trim();
    if (tagText && !tags.includes(tagText)) tags.push(tagText);
  });

  // Detect WFH
  if (
    link.includes("work-from-home") ||
    location.toLowerCase().includes("work from home")
  ) {
    if (!tags.includes("Work From Home")) tags.push("Work From Home");
  }

  return {
    title,
    company,
    location: location || "Not specified",
    stipend: stipend || "Not disclosed",
    duration,
    link,
    source: SOURCE,
    category,
    tags,
    apply_by: applyBy,
    start_date: startDate,
    applicants,
    description: null,
    skills,
    target_batch: targetBatch,
    deadline,
  };
}

/**
 * Fallback: parse with regex when DOM selectors fail
 */
function parseWithRegex(html, category) {
  const internships = [];
  const seen = new Set();

  // Pattern 1: job-title-href links
  const pattern1 =
    /class="job-title-href"[^>]*href="([^"]+)"[^>]*>(?:<[^>]+>\s*)*([^<]+)<\//gi;
  let match;
  while ((match = pattern1.exec(html)) !== null) {
    let link = match[1].trim();
    const title = match[2].trim();
    if (link.startsWith("/")) link = "https://internshala.com" + link;

    if (seen.has(link) || title.length < 3) continue;
    seen.add(link);

    // Extract location from URL
    let location = "Not specified";
    const locMatch = link.match(/internship-in-([a-z-]+)-at-/);
    if (locMatch)
      location = locMatch[1]
        .replace(/-/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
    if (link.includes("work-from-home")) location = "Work From Home";

    // Extract company from URL
    let company = "Unknown";
    const compMatch = link.match(/-at-([a-z0-9-]+?)(\d{5,})$/);
    if (compMatch)
      company = compMatch[1]
        .replace(/-/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());

    const tags = ["B.Tech"];
    if (category) tags.push(category);
    if (location === "Work From Home") tags.push("Work From Home");

    const currentYear = new Date().getFullYear();
    internships.push({
      title,
      company,
      location,
      stipend: "View on Internshala",
      duration: "",
      link,
      source: SOURCE,
      category,
      tags,
      apply_by: "",
      start_date: "",
      applicants: "",
      description: null,
      skills: inferSkillsFromTitle(title, category).join(", "),
      target_batch: `${currentYear}, ${currentYear + 1} batch`,
      deadline: "",
    });
  }

  // Pattern 2: internship detail links
  if (internships.length === 0) {
    const pattern2 =
      /<a[^>]*href="(\/internship\/detail\/[^"]+)"[^>]*>([^<]+)<\/a>/gi;
    while ((match = pattern2.exec(html)) !== null) {
      let link = "https://internshala.com" + match[1].trim();
      const title = match[2].trim();

      if (seen.has(link) || title.length < 3) continue;
      seen.add(link);

      const tags = ["B.Tech"];
      if (category) tags.push(category);

      const currentYear = new Date().getFullYear();
      internships.push({
        title,
        company: "Unknown",
        location: "Not specified",
        stipend: "View on Internshala",
        duration: "",
        link,
        source: SOURCE,
        category,
        tags,
        apply_by: "",
        start_date: "",
        applicants: "",
        description: null,
        skills: inferSkillsFromTitle(title, category).join(", "),
        target_batch: `${currentYear}, ${currentYear + 1} batch`,
        deadline: "",
      });
    }
  }

  return internships;
}

/**
 * Main scrape function — scrapes all B.Tech categories
 */
async function scrape() {
  console.log(
    `\n[${SOURCE}] Starting scrape — ${CATEGORY_URLS.length} categories`,
  );

  const allInternships = [];
  const seenLinks = new Set();

  for (const { url, category } of CATEGORY_URLS) {
    try {
      console.log(`  [${SOURCE}] Scraping: ${category}...`);
      const html = await fetchPage(url);
      const listings = parseListings(html, category);

      let added = 0;
      for (const item of listings) {
        if (!seenLinks.has(item.link)) {
          seenLinks.add(item.link);
          allInternships.push(item);
          added++;
        }
      }

      console.log(
        `  [${SOURCE}]   → ${added} new listings (${listings.length} total on page)`,
      );

      // Rate limiting — wait between requests
      await sleep(2500);
    } catch (err) {
      console.error(
        `  [${SOURCE}]   ✗ Failed to scrape ${category}: ${err.message}`,
      );
    }

    // Cap total
    if (allInternships.length >= 100) {
      console.log(`  [${SOURCE}] Reached 100 listings cap, stopping.`);
      break;
    }
  }

  console.log(`[${SOURCE}] Total unique listings: ${allInternships.length}`);
  return allInternships;
}

/**
 * Infer likely skills from the title and category of the internship
 */
function inferSkillsFromTitle(title, category) {
  const titleLower = (title + " " + (category || "")).toLowerCase();
  const skillMap = {
    Python: /python/i,
    Java: /\bjava\b/i,
    JavaScript: /javascript|\bjs\b|node|angular|vue/i,
    "C++": /c\+\+|cpp/i,
    SQL: /sql|database|mysql|postgres/i,
    "Machine Learning": /machine learning|\bml\b/i,
    "Data Science": /data science|data analy/i,
    AI: /artificial intelligence|\bai\b|deep learning/i,
    "Node.js": /node\.?js|nodejs/i,
    Django: /django/i,
    Flutter: /flutter/i,
    Android: /android/i,
    iOS: /ios|swift/i,
    AWS: /aws|cloud|azure/i,
    Docker: /docker|kubernetes|devops/i,
    "Embedded C": /embedded|microcontroller|arduino/i,
    VLSI: /vlsi|verilog/i,
    AutoCAD: /autocad|solidworks|cad/i,
    MATLAB: /matlab/i,
    PHP: /\bphp\b/i,
    "HTML/CSS": /html|css|frontend|front.?end/i,
    Excel: /excel|spreadsheet/i,
    "Power BI": /power bi|tableau/i,
    NLP: /\bnlp\b|natural language/i,
    "Computer Vision": /computer vision|opencv/i,
    Git: /\bgit\b|github/i,
    Figma: /figma|ui.?ux|design/i,
    WordPress: /wordpress/i,
    Cybersecurity: /cyber|security|penetration/i,
  };

  const matched = [];
  for (const [skill, pattern] of Object.entries(skillMap)) {
    if (pattern.test(titleLower) && !matched.includes(skill)) {
      matched.push(skill);
    }
  }
  return matched;
}

module.exports = { scrape, SOURCE };
