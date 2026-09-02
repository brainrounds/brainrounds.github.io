import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the built app works from any path: the root of a domain,
  // a GitHub Pages project sub-path, or a plain folder on a local web server.
  base: './',
  build: {
    // The target tablet is old enough to still be running Lumosity's Android app,
    // so do not assume a current browser engine.
    target: 'es2017',
  },
});
