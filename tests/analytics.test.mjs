import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const layout = await readFile(new URL('../src/layouts/Base.astro', import.meta.url), 'utf8');
const scripts = [...layout.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)];
const loader = scripts.find(([, attributes]) => attributes.includes('googletagmanager.com'));
const initializer = scripts.find(([, , content]) => content.includes('window.dataLayer'));

test('both Google Analytics scripts remain unprocessed by Astro', () => {
  assert.ok(loader);
  assert.ok(initializer);
  assert.match(loader[1], /\bis:inline\b/);
  assert.match(loader[1], /\basync\b/);
  assert.match(loader[1], /src="https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=G-6MF2B6H28V"/);
  assert.match(initializer[1], /\bis:inline\b/);
});

test('the analytics snippet queues initialization and configuration as browser globals', () => {
  const browser = {};
  browser.window = browser;
  runInNewContext(initializer[2], browser);
  assert.equal(typeof browser.gtag, 'function');
  assert.equal(browser.dataLayer.length, 2);
  assert.equal(browser.dataLayer[0][0], 'js');
  assert.equal(Object.prototype.toString.call(browser.dataLayer[0][1]), '[object Date]');
  assert.deepEqual(Array.from(browser.dataLayer[1]), ['config', 'G-6MF2B6H28V']);
});

test('analytics initialization preserves an existing data layer', () => {
  const queue = [['existing-event']];
  const browser = { dataLayer: queue };
  browser.window = browser;
  runInNewContext(initializer[2], browser);
  assert.equal(browser.dataLayer, queue);
  assert.deepEqual(browser.dataLayer[0], ['existing-event']);
  assert.equal(browser.dataLayer.length, 3);
});
