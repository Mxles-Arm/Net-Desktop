'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '../..');
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');

test('frontend classic scripts parse and load in dependency order', () => {
  const scripts = [
    'frontend/js/api.js',
    'frontend/js/app.js',
    'frontend/js/desktop-window.js',
    'frontend/js/knowledge-browser.js',
    'frontend/js/navi.js',
    'frontend/js/cai.js',
  ];
  scripts.forEach((file) => assert.doesNotThrow(() => new vm.Script(read(file), { filename: file })));

  const html = read('frontend/index.html');
  const positions = scripts.map((file) => html.indexOf(`src="${file.replace('frontend/', '')}"`));
  positions.forEach((position, index) => assert.ok(position >= 0, `${scripts[index]} must be loaded by index.html`));
  assert.deepEqual([...positions].sort((a, b) => a - b), positions, 'frontend scripts must preserve dependency order');
});

test('frontend feature modules expose their documented public contracts', () => {
  assert.match(read('frontend/js/desktop-window.js'), /window\.DesktopWindows\s*=\s*\{\s*open,\s*renderMinimized\s*\}/);
  assert.match(read('frontend/js/knowledge-browser.js'), /window\.NetKnowledge\s*=\s*\{\s*open,\s*search\s*\}/);
  assert.match(read('frontend/js/navi.js'), /window\.NaviAssistant\s*=\s*\{\s*open\s*\}/);
  assert.doesNotMatch(read('frontend/js/app.js'), /const NET_KNOWLEDGE|function openDesktopApp/);
  assert.doesNotMatch(read('frontend/js/cai.js'), /async function naviAnswer|naviConversation/);
});

test('feature stylesheets are loaded and have balanced blocks', () => {
  const styles = [
    'frontend/css/desktop-windows.css',
    'frontend/css/knowledge-browser.css',
    'frontend/css/navi.css',
  ];
  const html = read('frontend/index.html');
  styles.forEach((file) => {
    assert.match(html, new RegExp(`href="${file.replace('frontend/', '').replace('.', '\\.')}"`));
    const css = read(file);
    const opens = (css.match(/\{/g) || []).length;
    const closes = (css.match(/\}/g) || []).length;
    assert.equal(opens, closes, `${file} must have balanced braces`);
  });
});
