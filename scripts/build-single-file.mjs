/*
 * Inline the built site into one self-contained HTML file.
 *
 * The normal build is a page plus hashed asset files, which is right for a real
 * host. This produces a single file for places that can only take one — a share
 * link, an email attachment, a USB stick handed to someone without a host.
 *
 * Run after `npm run build`:  node scripts/build-single-file.mjs
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dist = 'dist';
const assets = readdirSync(join(dist, 'assets'));
const css = assets.find((name) => name.endsWith('.css'));
const js = assets.find((name) => name.endsWith('.js'));
if (!css || !js) throw new Error('run `npm run build` first — dist/assets is missing a css or js file');

const icon = readFileSync(join(dist, 'icon.svg'), 'utf8');
const iconUrl = `data:image/svg+xml;base64,${Buffer.from(icon, 'utf8').toString('base64')}`;

const html = readFileSync(join(dist, 'index.html'), 'utf8')
  .replace(/<link rel="stylesheet"[^>]*>/, `<style>\n${readFileSync(join(dist, 'assets', css), 'utf8')}\n</style>`)
  .replace(
    /<script type="module"[^>]*><\/script>/,
    `<script type="module">\n${readFileSync(join(dist, 'assets', js), 'utf8')}\n</script>`,
  )
  // A single file has no separate manifest or icon files to point at.
  .replace(/<link rel="manifest"[^>]*>\s*/, '')
  .replace(/<link rel="apple-touch-icon"[^>]*>\s*/, '')
  .replace(/href="\.\/icon\.svg"/, `href="${iconUrl}"`);

const out = join(dist, 'brain-rounds.html');
writeFileSync(out, html, 'utf8');
console.log(`${out} — ${(html.length / 1024).toFixed(1)} kB`);
