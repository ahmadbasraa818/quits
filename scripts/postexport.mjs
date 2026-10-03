// GitHub Pages serves 404.html for any path it doesn't know. Making it a copy
// of index.html lets a deep link such as /quits/group/demo_japan load the app,
// which then routes to the right screen.
import { copyFileSync, writeFileSync } from 'node:fs';

copyFileSync('dist/index.html', 'dist/404.html');
// Expo names some files with a leading underscore, which Jekyll would hide.
writeFileSync('dist/.nojekyll', '');
console.log('Added dist/404.html and dist/.nojekyll');
