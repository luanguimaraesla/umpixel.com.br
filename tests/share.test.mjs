import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/lib/share.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
});
const { sharePage } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const url = 'https://umpixel.com.br/';
const title = 'UM PIXEL';

function mockNavigator(context, value) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value });
  context.after(() => {
    if (previous) Object.defineProperty(globalThis, 'navigator', previous);
    else delete globalThis.navigator;
  });
}

test('sharing uses the native menu when available', async context => {
  const share = context.mock.fn(async () => {});
  const writeText = context.mock.fn(async () => {});
  mockNavigator(context, { share, clipboard: { writeText } });
  assert.equal(await sharePage(url, title), '');
  assert.deepEqual(share.mock.calls[0].arguments, [{ title, url }]);
  assert.equal(writeText.mock.callCount(), 0);
});

test('cancelling native sharing does not copy the link or report an error', async context => {
  const share = context.mock.fn(async () => { throw new DOMException('Cancelled', 'AbortError'); });
  const writeText = context.mock.fn(async () => {});
  mockNavigator(context, { share, clipboard: { writeText } });
  assert.equal(await sharePage(url, title), '');
  assert.equal(writeText.mock.callCount(), 0);
});

test('sharing copies the link when the native menu is unavailable', async context => {
  const writeText = context.mock.fn(async () => {});
  mockNavigator(context, { clipboard: { writeText } });
  assert.equal(await sharePage(url, title), 'Link copiado!');
  assert.deepEqual(writeText.mock.calls[0].arguments, [url]);
});

test('a native sharing failure falls back to copying the link', async context => {
  const writeText = context.mock.fn(async () => {});
  mockNavigator(context, {
    share: async () => { throw new DOMException('Denied', 'NotAllowedError'); },
    clipboard: { writeText },
  });
  assert.equal(await sharePage(url, title), 'Link copiado!');
  assert.deepEqual(writeText.mock.calls[0].arguments, [url]);
});

test('a clipboard failure leaves the link available for manual sharing', async context => {
  mockNavigator(context, {
    clipboard: { writeText: async () => { throw new DOMException('Denied', 'NotAllowedError'); } },
  });
  assert.equal(await sharePage(url, title), `Não foi possível copiar. Compartilhe este link: ${url}`);
});

test('browsers without sharing or clipboard APIs show the link', async context => {
  mockNavigator(context, {});
  assert.equal(await sharePage(url, title), `Não foi possível copiar. Compartilhe este link: ${url}`);
});
