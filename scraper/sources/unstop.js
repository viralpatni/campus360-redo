// ============================================
// Campus360 Scraper — Unstop (formerly D2C) Source
// Scrapes internship listings from unstop.com
// ============================================

const cheerio = require('cheerio');
const { fetchPage, sleep } = require('../http');

const SOURCE = 'Unstop';

// Unstop uses an API endpoint for listings — much cleaner than HTML scraping
const API_URL = 'https://unstop.com/api/public/opportunity/search-result';

// Categories to search
const SEARCH_QUERIES = [
  'software engineering intern',
  'data science intern',
  'web development intern',
  'machine learning intern',
  'electronics intern',
  'mechanical engineering intern',
  'backend developer intern',
  'frontend developer intern',
  'mobile app developer intern',
  'devops intern',
];

/**
 * Try to fetch from Unstop's API
 */
async function fetchFromAPI(query) {
  const internships = [];

  try {
    // Unstop has a search API — try to use it
    const searchUrl = `https://unstop.com/api/public/opportunity/search-result?opportunity=jobs&per_page=20&oppstatus=open&search=${encodeURIComponent(query)}`;

    const data = await fetchPage(searchUrl, {
      Accept: 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      Referer: 'https://unstop.com/internships',
    });

    // data might be JSON string or already parsed
    const json = typeof data === 'string' ? JSON.parse(data) : data;

    if (json?.data?.data && Array.isArray(json.data.data)) {
      for (const item of json.data.data) {
        const title = item.title || item.name || '';
        const organisation = item.organisation?.name || item.company_name || 'Unknown';
        const link = item.public_url
          ? `https://unstop.com${item.public_url}`
          : item.seo_url
            ? `https://unstop.com/${item.seo_url}`
            : '';

        if (!title || !link) continue;

        const tags = ['B.Tech'];
        if (item.type) tags.push(item.type);
        if (item.mode) tags.push(item.mode);

        const deadlineRaw = item.end_date || item.regnRequirements?.end_regn_dt || '';
        const skillsArr = item.skills?.map(s => s.name || s) || [];
        const eligibility = item.eligibility || item.eligible || '';
        const currentYear = new Date().getFullYear();

        internships.push({
          title,
          company: organisation,
          location: item.location || item.city || 'Not specified',
          stipend: item.stipend || item.prize || 'Not disclosed',
          duration: item.duration || '',
          link,
          source: SOURCE,
          category: query,
          tags,
          apply_by: deadlineRaw,
          start_date: item.start_date || '',
          applicants: item.registrations_count ? `${item.registrations_count} applicants` : '',
          description: item.short_desc || item.description || null,
          skills: skillsArr.join(', ') || query,
          target_batch: typeof eligibility === 'string' && eligibility ? eligibility : `${currentYear}, ${currentYear + 1} batch`,
          deadline: deadlineRaw,
        });
      }
    }
  } catch (err) {
    // API didn't work, try HTML scraping fallback
    return [];
  }

  return internships;
}

/**
 * Fallback: scrape Unstop HTML listing pages
 */
async function fetchFromHTML() {
  const internships = [];

  try {
    const url = 'https://unstop.com/internships';
    const html = await fetchPage(url);
    const $ = cheerio.load(html);

    // Unstop renders its listings mostly client-side, but some SSR data exists
    // Look for JSON-LD or embedded data
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const json = JSON.parse($(el).html());
        if (json['@type'] === 'ItemList' && json.itemListElement) {
          for (const item of json.itemListElement) {
            const jobPosting = item.item || item;
            if (jobPosting['@type'] !== 'JobPosting') continue;

            const tags = ['B.Tech'];
            if (jobPosting.employmentType) tags.push(jobPosting.employmentType);

            const currentYear = new Date().getFullYear();
            internships.push({
              title: jobPosting.title || '',
              company: jobPosting.hiringOrganization?.name || 'Unknown',
              location: jobPosting.jobLocation?.address?.addressLocality || 'Not specified',
              stipend: jobPosting.baseSalary?.value?.value
                ? `₹${jobPosting.baseSalary.value.value}`
                : 'Not disclosed',
              duration: '',
              link: jobPosting.url || '',
              source: SOURCE,
              category: '',
              tags,
              apply_by: jobPosting.validThrough || '',
              start_date: jobPosting.datePosted || '',
              applicants: '',
              description: jobPosting.description?.substring(0, 500) || null,
              skills: jobPosting.skills?.join(', ') || '',
              target_batch: `${currentYear}, ${currentYear + 1} batch`,
              deadline: jobPosting.validThrough || '',
            });
          }
        }
      } catch (e) {
        // Skip invalid JSON-LD
      }
    });

    // Also try parsing regular listing cards
    $('.single_opportunity, .opportunity-card, [class*="opp-card"]').each((_, el) => {
      const $card = $(el);
      const title = $card.find('h2, h3, .title, .opp-title').first().text().trim();
      let link = $card.find('a').first().attr('href') || '';

      if (!title || !link) return;
      if (!link.startsWith('http')) link = 'https://unstop.com' + link;

      const deadlineText = $card.find('.deadline, .end-date').first().text().trim() || '';
      const currentYear = new Date().getFullYear();
      internships.push({
        title,
        company: $card.find('.org-name, .company').first().text().trim() || 'Unknown',
        location: $card.find('.location').first().text().trim() || 'Not specified',
        stipend: $card.find('.stipend, .prize').first().text().trim() || 'Not disclosed',
        duration: '',
        link,
        source: SOURCE,
        category: '',
        tags: ['B.Tech'],
        apply_by: deadlineText,
        start_date: '',
        applicants: '',
        description: null,
        skills: '',
        target_batch: `${currentYear}, ${currentYear + 1} batch`,
        deadline: deadlineText,
      });
    });
  } catch (err) {
    console.error(`  [${SOURCE}] HTML fallback failed: ${err.message}`);
  }

  return internships;
}

/**
 * Main scrape function
 */
async function scrape() {
  console.log(`\n[${SOURCE}] Starting scrape...`);

  const allInternships = [];
  const seenLinks = new Set();

  // Try API first
  for (const query of SEARCH_QUERIES) {
    try {
      console.log(`  [${SOURCE}] Searching API: "${query}"...`);
      const results = await fetchFromAPI(query);

      let added = 0;
      for (const item of results) {
        if (item.link && !seenLinks.has(item.link)) {
          seenLinks.add(item.link);
          allInternships.push(item);
          added++;
        }
      }

      if (added > 0) {
        console.log(`  [${SOURCE}]   → ${added} new listings`);
      }

      await sleep(2000);
    } catch (err) {
      console.error(`  [${SOURCE}]   ✗ API search failed for "${query}": ${err.message}`);
    }

    if (allInternships.length >= 80) break;
  }

  // If API yielded nothing, try HTML
  if (allInternships.length === 0) {
    console.log(`  [${SOURCE}] API returned no results, trying HTML fallback...`);
    const htmlResults = await fetchFromHTML();

    for (const item of htmlResults) {
      if (item.link && !seenLinks.has(item.link)) {
        seenLinks.add(item.link);
        allInternships.push(item);
      }
    }
  }

  console.log(`[${SOURCE}] Total unique listings: ${allInternships.length}`);
  return allInternships;
}

module.exports = { scrape, SOURCE };
