/**
 * Capture documentation screenshots of the BU Scheduler frontend.
 *
 * Usage:
 *   npm run dev                 # in one terminal (http://localhost:5173)
 *   node scripts/screenshots.mjs
 *
 * Optional env vars:
 *   BASE_URL          default http://localhost:5173
 *   OUT_DIR           default docs/screenshots
 *   CHROME_PATH       path to a Chromium/Chrome binary (defaults to Playwright's bundled build)
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:5173';
const OUT_DIR = process.env.OUT_DIR ?? 'docs/screenshots';

/** Pages captured for the README / docs gallery. */
const SHOTS = [
  { name: 'login',       route: '/login',              wait: 1800 },
  { name: 'home',        route: '/home',               wait: 2500 },
  { name: 'timetable',   route: '/timetable',          wait: 2500 },
  { name: 'groups',      route: '/groups',             wait: 2500 },
  { name: 'chat',        route: '/chat',               wait: 2500 },
  { name: 'notifications', route: '/notifications',    wait: 2500 },
  { name: 'profile',     route: '/profile',            wait: 2500 },
  { name: 'bulk-import', route: '/import',             wait: 2000 },
  { name: 'not-found',   route: '/this-route-does-not-exist', wait: 1200 },
];

const VIEWPORTS = [
  { id: 'desktop', width: 1440, height: 900,  isMobile: false },
  { id: 'mobile',  width: 390,  height: 844,  isMobile: true  },
];

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
  });

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2,
      isMobile: vp.isMobile,
      hasTouch: vp.isMobile,
      colorScheme: 'light',
      reducedMotion: 'reduce',
    });

    const page = await context.newPage();
    page.on('console', () => {});
    page.on('pageerror', () => {});

    for (const shot of SHOTS) {
      const url = `${BASE_URL}${shot.route}`;
      try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
      } catch {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 }).catch(() => {});
      }
      await page.waitForTimeout(shot.wait);

      const file = path.join(OUT_DIR, `${shot.name}-${vp.id}.png`);
      await page.screenshot({ path: file, fullPage: false });
      console.log(`captured ${file}`);
    }

    await context.close();
  }

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
