import { copyFileSync } from 'node:fs';
copyFileSync('dist/index.html', 'dist/200.html');
copyFileSync('dist/index.html', 'dist/404.html');