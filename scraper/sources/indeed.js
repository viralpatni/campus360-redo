// ============================================
// Campus360 Scraper — Indeed Source
// Scrapes internship listings from Indeed India
// ============================================

const cheerio = require('cheerio');
const { fetchPage, sleep } = require('../http');

const SOURCE = 'Indeed';

// Search queries for B.Tech-relevant internships
const SEARCH_QUERIES = [
  { q: 'software intern', l: 'India' },
  { q: 'data science intern', l: 'India' },
  { q: 'web developer intern', l: 'India' },
  { q: 'machine learning intern', l: 'India' },
  { q: 'mechanical engineer intern', l: 'India' },
  { q: 'electronics intern', l: 'India' },
  { q: 'civil engineering intern', l: 'India' },
  { q: 'python developer intern', l: 'India' },
  { q: 'devops intern', l: 'India' },
];

/**
 * Parse Indeed search results page
 */
function parseSearchResults(html) {
  const $ = cheerio.load(html);
  const internships = [];

  // Indeed wraps each result in various containers
  const cardSelectors = [
    '.job_seen_beacon',
    '.jobsearch-ResultsList > li',
    '.resultContent',
    '.tapItem',
    '[data-jk]',
  ];

  let $cards = $([]);
  for (const sel of cardSelectors) {
    $cards = $(sel);
    if ($cards.length > 0) break;
  }

  $cards.each((_, el) => {
    const $card = $(el);

    // Title
    const $titleEl = $card.find('h2.jobTitle a, .jobTitle > a, a[data-jk]').first();
    const title = $titleEl.text().trim() || $card.find('.jobTitle span[title]').first().attr('title') || '';

    if (!title || title.length < 3) return;

    // Link
    let link = $titleEl.attr('href') || '';
    if (link && !link.startsWith('http')) {
      link = 'https://in.indeed.com' + link;
    }

    // Extract job key for deduplication
    const jobKey = $card.attr('data-jk') || $titleEl.attr('data-jk') || '';
    if (!link && jobKey) {
      link = `https://in.indeed.com/viewjob?jk=${jobKey}`;
    }

    if (!link) return;

    // Company
    const company = (
      $card.find('.companyName, .company, [data-testid="company-name"]').first().text().trim() ||
      'Unknown'
    );

    // Location
    const location = (
      $card.find('.companyLocation, .location, [data-testid="text-location"]').first().text().trim() ||
      'India'
    );

    // Salary/stipend
    const stipend = (
      $card.find('.salary-snippet, .salaryText, [data-testid="attribute_snippet_testid"]').first().text().trim() ||
      'Not disclosed'
    );

    // Description snippet
    const description = (
      $card.find('.job-snippet, .job-snippet ul li, [class*="job-snippet"]').map((_, el) => $(el).text().trim()).get().join(' ') ||
      null
    );

    // Metadata
    const metadata = $card.find('.metadata .attribute_snippet, .metadata span').map((_, el) => $(el).text().trim()).get();

    const tags = ['B.Tech', 'Internship'];
    if (location.toLowerCase().includes('remote') || location.toLowerCase().includes('work from home')) {
      tags.push('Work From Home');
    }

    const currentYear = new Date().getFullYear();
    internships.push({
      title,
      company,
      location,
      stipend,
      duration: '',
      link,
      source: SOURCE,
      category: '',
      tags,
      apply_by: '',
      start_date: '',
      applicants: '',
      description: description?.substring(0, 500) || null,
      skills: metadata.join(', ') || '',
      target_batch: `${currentYear}, ${currentYear + 1} batch`,
      deadline: '',
    });
  });

  // Fallback: try extracting from embedded JSON (Indeed sometimes embeds mosaic data)
  if (internships.length === 0) {
    const jsonMatch = html.match(/window\.mosaic\.providerData\["mosaic-provider-jobcards"\]\s*=\s*({.+?});/s);
    if (jsonMatch) {
      try {
        const data = JSON.parse(jsonMatch[1]);
        const results = data?.metaData?.mosaicProviderJobCardsModel?.results || [];

        for (const item of results) {
          const title = item.title || '';
          const link = item.jobkey
            ? `https://in.indeed.com/viewjob?jk=${item.jobkey}`
            : '';

          if (!title || !link) continue;

          const tags = ['B.Tech', 'Internship'];

          const currentYear = new Date().getFullYear();
          internships.push({
            title,
            company: item.company || 'Unknown',
            location: item.formattedLocation || item.location || 'India',
            stipend: item.salary?.text || item.extractedSalary?.text || 'Not disclosed',
            duration: '',
            link,
            source: SOURCE,
            category: '',
            tags,
            apply_by: '',
            start_date: item.formattedRelativeTime || '',
            applicants: '',
            description: item.snippet?.substring(0, 500) || null,
            skills: '',
            target_batch: `${currentYear}, ${currentYear + 1} batch`,
            deadline: '',
          });
        }
      } catch (e) {
        // JSON parse failed
      }
    }
  }

  return internships;
}

/**
 * Main scrape function
 */
async function scrape() {
  console.log(`\n[${SOURCE}] Starting scrape — ${SEARCH_QUERIES.length} queries`);

  const allInternships = [];
  const seenLinks = new Set();

  for (const { q, l } of SEARCH_QUERIES) {
    try {
      const url = `https://in.indeed.com/jobs?q=${encodeURIComponent(q)}&l=${encodeURIComponent(l)}&fromage=14&sort=date`;
      console.log(`  [${SOURCE}] Searching: "${q}" in ${l}...`);

      const html = await fetchPage(url, {
        Referer: 'https://in.indeed.com/',
      });

      const listings = parseSearchResults(html);

      let added = 0;
      for (const item of listings) {
        if (item.link && !seenLinks.has(item.link)) {
          seenLinks.add(item.link);
          allInternships.push(item);
          added++;
        }
      }

      console.log(`  [${SOURCE}]   → ${added} new listings`);
      await sleep(3000); // Indeed is strict about rate limiting
    } catch (err) {
      console.error(`  [${SOURCE}]   ✗ Failed for "${q}": ${err.message}`);
    }

    if (allInternships.length >= 80) break;
  }

  console.log(`[${SOURCE}] Total unique listings: ${allInternships.length}`);
  return allInternships;
}

module.exports = { scrape, SOURCE };
