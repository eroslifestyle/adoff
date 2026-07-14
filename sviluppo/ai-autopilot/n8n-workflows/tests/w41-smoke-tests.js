/**
 * W41 Learning Loop Engine — Smoke Tests
 * Purpose: Validate workflow execution, data integrity, output correctness
 * Requires: Node.js 18+, pg (PostgreSQL), axios (HTTP)
 *
 * Usage:
 *   npm install pg axios dotenv
 *   node tests/w41-smoke-tests.js
 */

const { Client } = require('pg');
const axios = require('axios');
require('dotenv').config();

const DB_CONFIG = {
  host: process.env.ADOFF_PG_HOST || 'postgres.leobox.internal',
  port: process.env.ADOFF_PG_PORT || 5432,
  database: process.env.ADOFF_PG_DATABASE || 'adoff_autopilot',
  user: process.env.ADOFF_PG_USER || 'adoff_writer',
  password: process.env.ADOFF_PG_PASSWORD,
};

const N8N_CONFIG = {
  webhook_url: process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/learning-run',
  webhook_secret: process.env.N8N_WEBHOOK_SECRET || '',
};

const TELEGRAM_CONFIG = {
  token: process.env.TELEGRAM_BOT_TOKEN,
  chat_id: process.env.TELEGRAM_CHAT_ID_ADMIN,
};

// ============================================================================
// Test Suite
// ============================================================================

const tests = [];
let client;

function test(name, fn) {
  tests.push({ name, fn });
}

async function runTests() {
  console.log('🧪 W41 Learning Loop Engine — Smoke Tests\n');
  console.log(`Connected to: ${DB_CONFIG.host}:${DB_CONFIG.port}/${DB_CONFIG.database}\n`);

  client = new Client(DB_CONFIG);
  await client.connect();

  let passed = 0;
  let failed = 0;

  for (const t of tests) {
    try {
      process.stdout.write(`  ${t.name} ... `);
      await t.fn();
      console.log('✓');
      passed++;
    } catch (err) {
      console.log(`✗ (${err.message})`);
      failed++;
    }
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  await client.end();

  process.exit(failed > 0 ? 1 : 0);
}

// ============================================================================
// Helper Functions
// ============================================================================

async function queryDB(sql, params = []) {
  const res = await client.query(sql, params);
  return res.rows;
}

async function cleanupTestData() {
  await queryDB(`
    DELETE FROM metrics WHERE created_at > NOW() - INTERVAL '1 hour';
    DELETE FROM social_published WHERE created_at > NOW() - INTERVAL '1 hour';
    DELETE FROM gemini_copy_drafts WHERE created_at > NOW() - INTERVAL '1 hour';
  `);
}

async function insertTestMetrics(count = 10) {
  const platforms = ['instagram', 'tiktok', 'facebook'];
  const languages = ['IT', 'EN', 'DE'];
  const topicTags = ['privacy', 'tracking-blocker', 'encryption', 'anti-surveillance'];

  for (let i = 0; i < count; i++) {
    const platform = platforms[i % platforms.length];
    const lang = languages[i % languages.length];
    const topic = topicTags[i % topicTags.length];

    const result = await queryDB(`
      INSERT INTO gemini_copy_drafts (body, topic_tag, lang)
      VALUES ($1, $2, $3)
      RETURNING id
    `, [`Draft ${i}`, topic, lang]);

    const draftId = result[0].id;

    const spResult = await queryDB(`
      INSERT INTO social_published (draft_id, caption, hashtags, lang, asset_type, published_at, platform)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `, [
      draftId,
      `Caption ${i}`,
      '#privacy,#adblock,#tracking',
      lang,
      'video',
      new Date(Date.now() - i * 86400000),
      platform,
    ]);

    const spId = spResult[0].id;

    await queryDB(`
      INSERT INTO metrics (platform, likes, comments, shares, views, engagement_rate, social_published_id, measured_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      platform,
      Math.floor(Math.random() * 100),
      Math.floor(Math.random() * 30),
      Math.floor(Math.random() * 10),
      Math.floor(Math.random() * 1000) + 100,
      Math.random() * 10,
      spId,
      new Date(),
    ]);
  }
}

// ============================================================================
// Test 1: Database Connectivity
// ============================================================================

test('Database connectivity', async () => {
  const result = await queryDB('SELECT 1 as ok');
  if (!result || result.length === 0) throw new Error('No result from SELECT 1');
});

// ============================================================================
// Test 2: Table Existence
// ============================================================================

test('Required tables exist', async () => {
  const tables = ['metrics', 'social_published', 'gemini_copy_drafts', 'performance_insights', 'marketing_config', 'content_seeds'];

  for (const table of tables) {
    const result = await queryDB(`
      SELECT 1 FROM information_schema.tables
      WHERE table_name = $1
    `, [table]);
    if (result.length === 0) throw new Error(`Table ${table} not found`);
  }
});

// ============================================================================
// Test 3: Index Validation
// ============================================================================

test('Required indexes exist', async () => {
  const indexes = [
    'idx_metrics_measured_at_desc',
    'idx_metrics_social_published_id',
    'idx_content_seeds_topic_tag',
  ];

  for (const idx of indexes) {
    const result = await queryDB(`
      SELECT 1 FROM pg_indexes
      WHERE indexname = $1
    `, [idx]);
    if (result.length === 0) throw new Error(`Index ${idx} not found`);
  }
});

// ============================================================================
// Test 4: Metrics Load (Warm Start)
// ============================================================================

test('Load 10 test metrics (warm start simulation)', async () => {
  await cleanupTestData();
  await insertTestMetrics(10);

  const result = await queryDB(`
    SELECT COUNT(*) as count FROM metrics
    WHERE created_at > NOW() - INTERVAL '1 hour'
  `);

  if (result[0].count < 10) throw new Error(`Expected 10 metrics, got ${result[0].count}`);
});

// ============================================================================
// Test 5: Cold Start Condition (< 10 metrics)
// ============================================================================

test('Detect cold-start (< 10 metrics)', async () => {
  await cleanupTestData();
  await insertTestMetrics(3);

  const result = await queryDB(`
    SELECT COUNT(*) as count FROM metrics
    WHERE measured_at >= NOW() - INTERVAL '14 days'
  `);

  if (result[0].count >= 10) throw new Error('Should have < 10 metrics for cold-start test');
});

// ============================================================================
// Test 6: Topic Aggregation Correctness
// ============================================================================

test('Topic scoring aggregation (expected format)', async () => {
  await cleanupTestData();
  await insertTestMetrics(15);

  // Simulate topic scoring
  const result = await queryDB(`
    SELECT
      COALESCE(gcd.topic_tag, 'untagged') AS topic,
      COUNT(*) AS post_count,
      SUM(m.likes + (m.comments * 2) + (m.shares * 3)) AS total_engagement
    FROM metrics m
    LEFT JOIN social_published sp ON m.social_published_id = sp.id
    LEFT JOIN gemini_copy_drafts gcd ON sp.draft_id = gcd.id
    WHERE m.measured_at >= NOW() - INTERVAL '14 days'
    GROUP BY COALESCE(gcd.topic_tag, 'untagged')
    HAVING COUNT(*) > 0
  `);

  if (result.length === 0) throw new Error('No topic scores generated');

  const firstScore = result[0];
  if (!firstScore.topic || firstScore.post_count === undefined || firstScore.total_engagement === undefined) {
    throw new Error('Topic score missing required fields');
  }
});

// ============================================================================
// Test 7: Hashtag Extraction & Aggregation
// ============================================================================

test('Hashtag extraction & aggregation', async () => {
  const result = await queryDB(`
    WITH hashtag_exploded AS (
      SELECT
        TRIM(regexp_split_to_table(sp.hashtags, ',')) AS hashtag,
        m.likes + (m.comments * 2) + (m.shares * 3) AS engagement
      FROM metrics m
      LEFT JOIN social_published sp ON m.social_published_id = sp.id
      WHERE m.measured_at >= NOW() - INTERVAL '14 days'
        AND sp.hashtags IS NOT NULL AND sp.hashtags != ''
    )
    SELECT COUNT(DISTINCT hashtag) as unique_tags FROM hashtag_exploded WHERE hashtag != ''
  `);

  if (result[0].unique_tags === undefined || result[0].unique_tags < 1) {
    throw new Error('Hashtag extraction failed');
  }
});

// ============================================================================
// Test 8: Language Performance Calculation
// ============================================================================

test('Language performance aggregation', async () => {
  const result = await queryDB(`
    SELECT
      COALESCE(sp.lang, 'unknown') AS lang,
      COUNT(*) AS post_count,
      ROUND(AVG(m.engagement_rate), 3) AS avg_engagement_rate
    FROM metrics m
    LEFT JOIN social_published sp ON m.social_published_id = sp.id
    WHERE m.measured_at >= NOW() - INTERVAL '14 days'
    GROUP BY COALESCE(sp.lang, 'unknown')
  `);

  if (result.length === 0) throw new Error('No language performance data');

  const firstLang = result[0];
  if (!firstLang.lang || firstLang.post_count === undefined) {
    throw new Error('Language performance missing required fields');
  }
});

// ============================================================================
// Test 9: Marketing Config Upsert
// ============================================================================

test('Marketing config upsert operation', async () => {
  const testData = { test_key: 'test_value', timestamp: new Date().toISOString() };

  await queryDB(`
    INSERT INTO marketing_config (key, config_data, last_updated)
    VALUES ($1, $2, NOW())
    ON CONFLICT (key) DO UPDATE SET config_data = EXCLUDED.config_data, last_updated = NOW()
  `, ['test_w41_key', JSON.stringify(testData)]);

  const result = await queryDB(`
    SELECT config_data FROM marketing_config WHERE key = $1
  `, ['test_w41_key']);

  if (result.length === 0) throw new Error('Config upsert failed');

  // Cleanup
  await queryDB(`DELETE FROM marketing_config WHERE key = $1`, ['test_w41_key']);
});

// ============================================================================
// Test 10: Performance Insights Insert
// ============================================================================

test('Performance insights batch insert', async () => {
  const beforeCount = await queryDB(`SELECT COUNT(*) as count FROM performance_insights WHERE metric_type = 'test_metric'`);

  await queryDB(`
    INSERT INTO performance_insights (topic, metric_type, score, details, valid_until, created_at)
    VALUES ($1, $2, $3, $4::jsonb, NOW() + INTERVAL '24 hours', NOW())
  `, ['test_topic', 'test_metric', 99.9, JSON.stringify({ test: true })]);

  const afterCount = await queryDB(`SELECT COUNT(*) as count FROM performance_insights WHERE metric_type = 'test_metric'`);

  if (afterCount[0].count <= beforeCount[0].count) {
    throw new Error('Performance insights insert failed');
  }

  // Cleanup
  await queryDB(`DELETE FROM performance_insights WHERE metric_type = 'test_metric'`);
});

// ============================================================================
// Test 11: Webhook Connectivity (if URL provided)
// ============================================================================

test('Webhook connectivity check', async () => {
  if (!N8N_CONFIG.webhook_url) {
    console.log('(skipped: N8N_WEBHOOK_URL not set)');
    return;
  }

  try {
    const response = await axios.post(N8N_CONFIG.webhook_url, {}, {
      timeout: 5000,
      validateStatus: () => true, // Accept any status
    });

    if (response.status >= 500) {
      throw new Error(`Webhook returned ${response.status}`);
    }
  } catch (err) {
    if (err.code === 'ECONNREFUSED') {
      console.log('(skipped: n8n unreachable)');
    } else {
      throw err;
    }
  }
});

// ============================================================================
// Test 12: Telegram API Connectivity (if token provided)
// ============================================================================

test('Telegram API connectivity check', async () => {
  if (!TELEGRAM_CONFIG.token || !TELEGRAM_CONFIG.chat_id) {
    console.log('(skipped: Telegram config not set)');
    return;
  }

  try {
    const response = await axios.post(
      `https://api.telegram.org/bot${TELEGRAM_CONFIG.token}/getMe`,
      {},
      { timeout: 5000 }
    );

    if (response.status !== 200 || !response.data.ok) {
      throw new Error('Telegram API returned invalid response');
    }
  } catch (err) {
    throw new Error(`Telegram API error: ${err.message}`);
  }
});

// ============================================================================
// Test 13: Query Performance (Metrics Load)
// ============================================================================

test('Query performance: load metrics (should be <500ms)', async () => {
  const startTime = Date.now();

  await queryDB(`
    SELECT m.*, sp.*, gcd.*
    FROM metrics m
    LEFT JOIN social_published sp ON m.social_published_id = sp.id
    LEFT JOIN gemini_copy_drafts gcd ON sp.draft_id = gcd.id
    WHERE m.measured_at >= NOW() - INTERVAL '14 days'
    ORDER BY m.measured_at DESC
  `);

  const duration = Date.now() - startTime;
  if (duration > 500) throw new Error(`Query took ${duration}ms (expected <500ms)`);
});

// ============================================================================
// Test 14: Execution Timeline (Cold Start)
// ============================================================================

test('Cold-start execution path (< 1 second)', async () => {
  await cleanupTestData();

  const startTime = Date.now();

  await queryDB(`
    SELECT COUNT(*) as count FROM metrics
    WHERE measured_at >= NOW() - INTERVAL '14 days'
  `);

  const duration = Date.now() - startTime;
  if (duration > 1000) throw new Error(`Cold-start took ${duration}ms (expected <1000ms)`);
});

// ============================================================================
// Summary Report
// ============================================================================

async function printSummary() {
  console.log('\n📊 System Status Summary\n');

  const metricsCount = await queryDB(`SELECT COUNT(*) as count FROM metrics`);
  console.log(`  Metrics in DB: ${metricsCount[0].count}`);

  const configKeys = await queryDB(`SELECT COUNT(*) as count FROM marketing_config`);
  console.log(`  Config Keys: ${configKeys[0].count}`);

  const insightsCount = await queryDB(`SELECT COUNT(*) as count FROM performance_insights WHERE valid_until > NOW()`);
  console.log(`  Valid Insights: ${insightsCount[0].count}`);

  const recentRun = await queryDB(`
    SELECT config_data->>'timestamp' as last_run
    FROM marketing_config
    WHERE key = 'last_learning_run_at'
    LIMIT 1
  `);

  if (recentRun.length > 0 && recentRun[0].last_run) {
    console.log(`  Last Run: ${recentRun[0].last_run}`);
  } else {
    console.log(`  Last Run: Never`);
  }

  console.log('');
}

// ============================================================================
// Main
// ============================================================================

(async () => {
  try {
    await runTests();
    await printSummary();
  } catch (err) {
    console.error('Fatal error:', err.message);
    process.exit(1);
  }
})();
