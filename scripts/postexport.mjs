// Finishes the web build for GitHub Pages.
import { createHash } from 'node:crypto';
import { copyFileSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

// GitHub Pages serves 404.html for any path it doesn't know. Making it a copy
// of index.html lets a deep link such as /quits/group/demo_japan load the app,
// which then routes to the right screen.
copyFileSync('dist/index.html', 'dist/404.html');
// The pages people reach from outside the app get a real copy, so they answer
// 200 rather than 404: a shared group's link, which messaging apps fetch to
// show a preview (some skip a 404), the privacy policy an app store links, and
// the help a support link points to. Pages serves /quits/import from
// import.html, with no redirect to a slash.
const ROUTES = ['import', 'privacy', 'help'];
for (const route of ROUTES) copyFileSync('dist/index.html', `dist/${route}.html`);
// Expo names some files with a leading underscore, which Jekyll would hide.
writeFileSync('dist/.nojekyll', '');

// The service worker keeps every file the app needs, under a version made from
// their contents, so any change to the build is a new version.
const walk = (folder) => readdirSync(folder).flatMap((name) => (statSync(join(folder, name)).isDirectory() ? walk(join(folder, name)) : [join(folder, name)]));
const files = walk('dist')
  .map((file) => relative('dist', file).split('\\').join('/'))
  .filter((file) => !['404.html', '.nojekyll', 'sw.js', 'metadata.json', ...ROUTES.map((route) => `${route}.html`)].includes(file))
  .sort();
const hash = createHash('sha256');
for (const file of files) hash.update(file).update(readFileSync(join('dist', file)));
const version = hash.digest('hex').slice(0, 12);
const urls = files.map((file) => `/quits/${file === 'index.html' ? '' : file}`);
const worker = readFileSync('scripts/sw.template.js', 'utf8').replace('__VERSION__', version).replace('__FILES__', JSON.stringify(urls, null, 2));
writeFileSync('dist/sw.js', worker);

console.log(`Added dist/404.html, ${ROUTES.map((route) => `dist/${route}.html`).join(', ')}, dist/.nojekyll and dist/sw.js (version ${version}, ${urls.length} files)`);
