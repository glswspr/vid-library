import { chromium } from 'playwright';

const url = process.argv[2] || 'http://localhost:5174/tv/1396/season/1/episode/1';

const browser = await chromium.launch();
const page = await browser.newPage();
const logs = [];
page.on('console', (msg) => logs.push(`[console.${msg.type()}] ${msg.text()}`));
page.on('pageerror', (err) => logs.push(`[pageerror] ${err.message}`));

await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(15000);

console.log('URL:', page.url());
console.log('--- LOGS ---');
console.log(logs.join('\n') || '(no console output)');
console.log('--- BODY SNIPPET ---');
const text = await page.evaluate(() => document.body.innerText.slice(0, 800));
console.log(text);

await browser.close();
