// ============================================
// Campus360 Scraper — HTTP Helper
// ============================================

const axios = require('axios');

const DEFAULT_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  Connection: 'keep-alive',
  'Cache-Control': 'no-cache',
};

/**
 * Fetch a URL with retry logic
 */
async function fetchPage(url, extraHeaders = {}, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await axios.get(url, {
        headers: { ...DEFAULT_HEADERS, ...extraHeaders },
        timeout: 20000,
        maxRedirects: 5,
        validateStatus: (s) => s < 400,
      });
      return response.data;
    } catch (err) {
      if (attempt === retries) {
        throw new Error(`Failed to fetch ${url}: ${err.message}`);
      }
      // Wait before retry (exponential backoff)
      await sleep(2000 * (attempt + 1));
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { fetchPage, sleep };
