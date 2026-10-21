import { build } from 'esbuild';
import { mkdirSync, copyFileSync } from 'node:fs';
mkdirSync('dist', { recursive: true });
await build({ entryPoints: ['src/main.tsx'], bundle: true, minify: true, outfile: 'dist/app.js', jsx: 'automatic', target: 'es2020', define: { 'process.env.NODE_ENV': '"production"' } });
await build({ entryPoints: ['src/styles.css'], bundle: true, minify: true, outfile: 'dist/app.css' });
copyFileSync('public/index.html', 'dist/index.html');
console.log('built dist/');
