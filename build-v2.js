#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const Terser = require('terser');
const UglifyCSS = require('uglifycss');

async function embedInlines(src, dest, baseDir) {
  try {
    const srcPath = path.resolve(baseDir, src);
    const destPath = path.resolve(baseDir, dest);
    let data = fs.readFileSync(srcPath, 'utf8');

    // Inline JS scripts
    const scriptRegex = /src="\/?(.*)" inline>/g;
    let match;
    const scriptReplacements = [];
    while ((match = scriptRegex.exec(data)) !== null) {
      const fullMatch = match[0];
      const relScriptPath = match[1];
      const fileToMinify = fs.existsSync(path.resolve(baseDir, relScriptPath))
        ? path.resolve(baseDir, relScriptPath)
        : path.resolve(__dirname, 'docs', relScriptPath);
      console.log(`Minifying JS: ${fileToMinify}`);
      const code = fs.readFileSync(fileToMinify, 'utf8');
      const minified = (await Terser.minify(code)).code;
      scriptReplacements.push({ fullMatch, replacement: `>${minified}` });
    }
    for (const r of scriptReplacements) {
      data = data.replace(r.fullMatch, r.replacement);
    }

    // Inline CSS links
    const cssRegex = /<link rel="stylesheet" href="\/?(.*)" inline>/g;
    const cssReplacements = [];
    while ((match = cssRegex.exec(data)) !== null) {
      const fullMatch = match[0];
      const relCssPath = match[1];
      const fileToMinify = fs.existsSync(path.resolve(baseDir, relCssPath))
        ? path.resolve(baseDir, relCssPath)
        : path.resolve(__dirname, 'docs', relCssPath);
      console.log(`Minifying CSS: ${fileToMinify}`);
      const minified = UglifyCSS.processFiles([fileToMinify]);
      cssReplacements.push({ fullMatch, replacement: `<style>${minified}</style>` });
    }
    for (const r of cssReplacements) {
      data = data.replace(r.fullMatch, r.replacement);
    }

    fs.writeFileSync(destPath, data);
    console.log(`Successfully generated: ${destPath}`);
  } catch (err) {
    console.error(`Error embedding inlines in ${src}:`, err);
    throw err;
  }
}

async function main() {
  const docsDir = path.resolve(__dirname, 'docs');
  const renderDir = path.resolve(docsDir, 'render');

  await embedInlines('index.html', 'index.min.html', docsDir);
  await embedInlines('recipe.html', 'recipe.min.html', renderDir);
  console.log('Build completed successfully!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
