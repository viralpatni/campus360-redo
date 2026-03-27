// ============================================
// Campus360 Scraper — Main Entry Point
// Usage: node index.js [--source=internshala|unstop|indeed]
// ============================================

const { upsertInternships, markStaleInternships, closePool } = require('./db');

// Import all sources
const internshala = require('./sources/internshala');
const unstop = require('./sources/unstop');
const indeed = require('./sources/indeed');

const ALL_SOURCES = [internshala, unstop, indeed];

// Parse CLI args
const args = process.argv.slice(2);
const sourceArg = args.find(a => a.startsWith('--source='));
const targetSource = sourceArg ? sourceArg.split('=')[1].toLowerCase() : 'all';

async function run() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║     Campus360 Internship Scraper         ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log(`Target: ${targetSource}`);

  const sourcesToRun = targetSource === 'all'
    ? ALL_SOURCES
    : ALL_SOURCES.filter(s => s.SOURCE.toLowerCase() === targetSource);

  if (sourcesToRun.length === 0) {
    console.error(`Unknown source: "${targetSource}". Available: internshala, unstop, indeed`);
    process.exit(1);
  }

  const totalStats = { inserted: 0, updated: 0, stale: 0, errors: 0 };

  for (const source of sourcesToRun) {
    try {
      // Scrape listings
      const listings = await source.scrape();

      if (listings.length === 0) {
        console.log(`[${source.SOURCE}] No listings found — skipping DB write`);
        continue;
      }

      // Upsert to database
      console.log(`[${source.SOURCE}] Writing ${listings.length} listings to database...`);
      const { inserted, updated } = await upsertInternships(listings);

      // Mark stale listings (ones not seen in this scrape)
      const activeLinks = listings.map(l => l.link).filter(Boolean);
      const stale = await markStaleInternships(source.SOURCE, activeLinks);

      console.log(`[${source.SOURCE}] ✓ ${inserted} new, ${updated} updated, ${stale} marked stale`);

      totalStats.inserted += inserted;
      totalStats.updated += updated;
      totalStats.stale += stale;
    } catch (err) {
      console.error(`[${source.SOURCE}] ✗ FATAL ERROR: ${err.message}`);
      totalStats.errors++;
    }
  }

  // Summary
  console.log('\n════════════════════════════════════════════');
  console.log('  SCRAPE COMPLETE');
  console.log(`  New: ${totalStats.inserted} | Updated: ${totalStats.updated} | Stale: ${totalStats.stale} | Errors: ${totalStats.errors}`);
  console.log(`  Finished at: ${new Date().toISOString()}`);
  console.log('════════════════════════════════════════════\n');

  await closePool();

  // Remove lock file so PHP knows we're done
  const fs = require('fs');
  const lockFile = __dirname + '/scraper.lock';
  try { fs.unlinkSync(lockFile); } catch (e) {}
}

run().catch(err => {
  console.error('[FATAL]', err);
  // Clean up lock file on error too
  const fs = require('fs');
  try { fs.unlinkSync(__dirname + '/scraper.lock'); } catch (e) {}
  process.exit(1);
});
