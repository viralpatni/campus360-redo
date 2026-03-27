// ============================================
// Campus360 Scraper — MySQL Database Connection
// ============================================

const mysql = require('mysql2/promise');

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'campus360',
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 5,
};

let pool;

function getPool() {
  if (!pool) {
    pool = mysql.createPool(DB_CONFIG);
  }
  return pool;
}

/**
 * Upsert internships into the database.
 * Uses INSERT ... ON DUPLICATE KEY UPDATE to avoid duplicates (keyed on link).
 */
async function upsertInternships(internships) {
  const db = getPool();
  let inserted = 0;
  let updated = 0;

  for (const item of internships) {
    try {
      const [result] = await db.execute(
        `INSERT INTO internships (title, company, location, stipend, duration, link, source, category, tags, apply_by, start_date, applicants, description, skills, target_batch, deadline)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           title = VALUES(title),
           company = VALUES(company),
           location = VALUES(location),
           stipend = VALUES(stipend),
           duration = VALUES(duration),
           source = VALUES(source),
           category = VALUES(category),
           tags = VALUES(tags),
           apply_by = VALUES(apply_by),
           start_date = VALUES(start_date),
           applicants = VALUES(applicants),
           description = VALUES(description),
           skills = VALUES(skills),
           target_batch = VALUES(target_batch),
           deadline = VALUES(deadline),
           is_active = 1,
           updated_at = CURRENT_TIMESTAMP`,
        [
          item.title || '',
          item.company || 'Unknown',
          item.location || 'Not specified',
          item.stipend || 'Not disclosed',
          item.duration || '',
          item.link || '',
          item.source || 'unknown',
          item.category || '',
          JSON.stringify(item.tags || []),
          item.apply_by || '',
          item.start_date || '',
          item.applicants || '',
          item.description || null,
          item.skills || '',
          item.target_batch || '',
          item.deadline || '',
        ]
      );

      if (result.affectedRows === 1) inserted++;
      else if (result.affectedRows === 2) updated++;
    } catch (err) {
      // Skip individual errors (e.g. constraint violations)
      if (!err.message.includes('Duplicate')) {
        console.error(`  [DB] Error inserting "${item.title}":`, err.message);
      }
    }
  }

  return { inserted, updated };
}

/**
 * Mark old internships from a source as inactive
 * (those not seen in the latest scrape)
 */
async function markStaleInternships(source, activeLinks) {
  if (!activeLinks.length) return 0;

  const db = getPool();
  const placeholders = activeLinks.map(() => '?').join(',');

  const [result] = await db.execute(
    `UPDATE internships SET is_active = 0
     WHERE source = ? AND link NOT IN (${placeholders})
     AND is_active = 1`,
    [source, ...activeLinks]
  );

  return result.affectedRows;
}

async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = { getPool, upsertInternships, markStaleInternships, closePool };
