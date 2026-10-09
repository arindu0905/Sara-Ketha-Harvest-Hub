// Builds the epic study guides: node build.js [E1 E2 ...]   → HTML + PDF (via headless Edge/Chrome)
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { CSS } = require('./common');

const BROWSERS = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
];
const browser = BROWSERS.find(p => fs.existsSync(p));
if (!browser) throw new Error('No Edge/Chrome found for PDF printing');

const wanted = process.argv.slice(2).map(s => s.toUpperCase());
const epics = ['e1', 'e2', 'e3', 'e4'].filter(f => fs.existsSync(path.join(__dirname, f + '.js')))
  .map(f => require('./' + f)).filter(e => !wanted.length || wanted.includes(e.id));

const out = path.join(__dirname, 'pdf');
fs.mkdirSync(out, { recursive: true });

for (const e of epics) {
  const toc = [...e.body.matchAll(/<h2>([^<]+)<\/h2>/g)].map(m => `<div>${m[1]}</div>`).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${e.title}</title><style>${CSS}</style></head><body>
<section class="cover">
  <div class="tag">Saara Ketha Harvest Hub · ISE_WE_0101_23</div>
  <h1>${e.title}</h1>
  <div class="sub">${e.sub}</div>
  <div class="toc">${toc}</div>
  <div class="meta">Study guide generated from the implemented system · October 2026</div>
</section>
${e.body}
<footer>${e.title} – Saara Ketha Harvest Hub study guide</footer>
</body></html>`;
  const htmlPath = path.join(out, e.file + '.html');
  const pdfPath = path.join(out, e.file + '.pdf');
  fs.writeFileSync(htmlPath, html);
  const profile = path.join(require('os').tmpdir(), 'hh-pdf-profile');
  execFileSync(browser, ['--headless=new', '--disable-gpu', '--no-first-run', `--user-data-dir=${profile}`, '--no-pdf-header-footer', `--print-to-pdf=${pdfPath}`, 'file:///' + htmlPath.replace(/\\/g, '/')], { stdio: 'ignore', timeout: 120000 });
  console.log('built', pdfPath, (fs.statSync(pdfPath).size / 1024).toFixed(0) + ' KB');
}
