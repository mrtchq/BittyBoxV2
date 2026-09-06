#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const Terser = require('terser');
const UglifyCSS = require('uglifycss');

async function buildV1() {
  const v1Dir = path.resolve(__dirname, 'docs', 'v1');

  // Minify data.js
  const dataJs = fs.readFileSync(path.join(v1Dir, 'data.js'), 'utf8');
  const minDataJs = (await Terser.minify(dataJs)).code;
  fs.writeFileSync(path.join(v1Dir, 'data-min.js'), minDataJs);

  // Minify index.js
  const indexJs = fs.readFileSync(path.join(v1Dir, 'index.js'), 'utf8');
  const minIndexJs = (await Terser.minify(indexJs)).code;
  fs.writeFileSync(path.join(v1Dir, 'index-min.js'), minIndexJs);

  // Minify index.css
  const minIndexCss = UglifyCSS.processFiles([path.join(v1Dir, 'index.css')]);
  fs.writeFileSync(path.join(v1Dir, 'index-min.css'), minIndexCss);

  // Process index.src.html -> index.html
  let srcHtml = fs.readFileSync(path.join(v1Dir, 'index.src.html'), 'utf8');
  const lines = srcHtml.split(/\r?\n/);
  const resultLines = [];
  for (const line of lines) {
    if (line.trim().startsWith('@include')) {
      const incPath = line.trim().split(/\s+/)[1];
      const fullIncPath = path.resolve(v1Dir, incPath);
      if (fs.existsSync(fullIncPath)) {
        resultLines.push(fs.readFileSync(fullIncPath, 'utf8'));
      } else {
        resultLines.push(line);
      }
    } else {
      resultLines.push(line);
    }
  }
  fs.writeFileSync(path.join(v1Dir, 'index.html'), resultLines.join('\n'));
  console.log('v1 built successfully!');
}

buildV1().catch((err) => {
  console.error('v1 build error:', err);
  process.exit(1);
});
