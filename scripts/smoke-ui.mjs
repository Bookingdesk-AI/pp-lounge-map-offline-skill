import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const DEFAULT_BASE_URL = 'https://loungeguru.desk.travel';
const DEFAULT_SELECTED_ID = 'candidate-chase-sapphire-bos-chase-sapphire-lounge-by-the-club';
const DEFAULT_EXPECTED_LOGO = 'chase-sapphire.svg';

const CHROME_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
];

export function parseUiSmokeArgs(args, env = process.env) {
  const options = {
    baseUrl: env.LOUNGE_GURU_UI_SMOKE_BASE_URL || DEFAULT_BASE_URL,
    selectedId: env.LOUNGE_GURU_UI_SMOKE_SELECTED_ID || DEFAULT_SELECTED_ID,
    expectedLogo: env.LOUNGE_GURU_UI_SMOKE_EXPECTED_LOGO || DEFAULT_EXPECTED_LOGO,
    chromeBin: env.CHROME_BIN || '',
    timeoutMs: Number(env.LOUNGE_GURU_UI_SMOKE_TIMEOUT_MS || 20_000),
    checkReviewQueue: env.LOUNGE_GURU_UI_SMOKE_CHECK_REVIEW_QUEUE === '1',
  };

  for (const arg of args) {
    if (arg === '--check-review-queue') {
      options.checkReviewQueue = true;
      continue;
    }
    if (arg.startsWith('--base-url=')) {
      options.baseUrl = arg.slice('--base-url='.length);
      continue;
    }
    if (arg.startsWith('--selected=')) {
      options.selectedId = arg.slice('--selected='.length);
      continue;
    }
    if (arg.startsWith('--expected-logo=')) {
      options.expectedLogo = arg.slice('--expected-logo='.length);
      continue;
    }
    if (arg.startsWith('--chrome-bin=')) {
      options.chromeBin = arg.slice('--chrome-bin='.length);
      continue;
    }
    if (arg.startsWith('--timeout-ms=')) {
      options.timeoutMs = Number(arg.slice('--timeout-ms='.length));
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  const url = new URL(options.baseUrl);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('UI smoke base URL must use HTTP or HTTPS');
  }
  if (!options.selectedId.trim()) {
    throw new Error('UI smoke selected id is required');
  }
  if (!Number.isFinite(options.timeoutMs) || options.timeoutMs < 5_000) {
    throw new Error('UI smoke timeout must be at least 5000ms');
  }

  return {
    ...options,
    baseUrl: url.origin,
  };
}

function findChrome(chromeBin) {
  if (chromeBin) {
    if (!fs.existsSync(chromeBin)) {
      throw new Error(`Chrome binary not found: ${chromeBin}`);
    }
    return chromeBin;
  }

  const found = CHROME_CANDIDATES.find((candidate) => fs.existsSync(candidate));
  if (!found) {
    throw new Error('Chrome binary not found. Set CHROME_BIN to run UI smoke.');
  }
  return found;
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function fetchJson(url, deadline) {
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return await response.json();
      }
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await wait(150);
  }
  throw lastError ?? new Error(`Timed out fetching ${url}`);
}

function connectToTarget(webSocketDebuggerUrl) {
  const socket = new WebSocket(webSocketDebuggerUrl);
  const pending = new Map();
  let nextId = 1;

  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) {
      return;
    }
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) {
      reject(new Error(message.error.message));
    } else {
      resolve(message.result);
    }
  });

  return new Promise((resolve, reject) => {
    socket.addEventListener('open', () => {
      resolve({
        send(method, params = {}) {
          return new Promise((resolveCommand, rejectCommand) => {
            const id = nextId++;
            pending.set(id, { resolve: resolveCommand, reject: rejectCommand });
            socket.send(JSON.stringify({ id, method, params }));
          });
        },
        close() {
          if (socket.readyState === WebSocket.CLOSED) {
            return Promise.resolve();
          }
          socket.close();
          return Promise.race([
            new Promise((resolveClose) => {
              socket.addEventListener('close', resolveClose, { once: true });
              socket.addEventListener('error', resolveClose, { once: true });
            }),
            wait(500),
          ]);
        },
      });
    });
    socket.addEventListener('error', reject);
  });
}

async function createTarget(port, url) {
  const encoded = encodeURIComponent(url);
  const response = await fetch(`http://127.0.0.1:${port}/json/new?${encoded}`, { method: 'PUT' });
  if (!response.ok) {
    throw new Error(`Chrome target creation failed: ${response.status}`);
  }
  return response.json();
}

function browserExpression({ mobile, expectedLogo }) {
  return `(() => {
    const text = document.body.innerText;
    const root = document.documentElement;
    const uiText = [
      document.querySelector('.topbar')?.innerText ?? '',
      document.querySelector('.rail-controls')?.innerText ?? '',
      document.querySelector('.mobile-actions')?.innerText ?? '',
    ].join('\\n');
    const programMarks = [...document.querySelectorAll('.program-brand-list .brand-mark')];
    const programLogos = [...document.querySelectorAll('.program-brand-list .brand-mark-img')];
    const brandImgs = [...document.querySelectorAll('.brand-mark-img')].map((img) => img.getAttribute('src'));
    const topbarText = document.querySelector('.topbar')?.innerText ?? '';
    const detailText = document.querySelector('.detail-panel, .mobile-selected-view')?.innerText ?? '';
    return {
      mobile: ${mobile},
      topbarText,
      detailVisible: detailText.length > 0,
      selectedVisible: /Chase Sapphire|American Express|Priority Pass|Capital One|Mastercard|Visa/.test(detailText),
      hasDevStats: Boolean(document.querySelector('.system-stats')) || /Catalog status|2644 records|752 airports/.test(topbarText),
      hasProofLabel: /\\bProof\\b/.test(text),
      hasForbiddenUiCopy: /Welcome|Get started|Discover|Powerful|Seamless|Intuitive|Unlock|Transform|All-in-one/.test(uiText),
      horizontalOverflow: root.scrollWidth > root.clientWidth + 1,
      programMarks: programMarks.length,
      programLogos: programLogos.length,
      expectedLogoShown: brandImgs.some((src) => src?.includes(${JSON.stringify(expectedLogo)})),
      visibleSearch: Boolean(document.querySelector('.search-wrap input, .rail-command-search input')),
    };
  })()`;
}

function assertViewport(result) {
  const failures = [];
  if (!result.detailVisible || !result.selectedVisible) failures.push('selected detail missing');
  if (result.hasDevStats) failures.push('dev stats visible');
  if (result.hasProofLabel) failures.push('proof label visible');
  if (result.hasForbiddenUiCopy) failures.push('forbidden UI copy visible');
  if (result.horizontalOverflow) failures.push('horizontal overflow');
  if (!result.visibleSearch) failures.push('search missing');
  if (result.programMarks < 1) failures.push('program mark missing');
  if (result.programLogos < 1) failures.push('program logo missing');
  if (!result.expectedLogoShown) failures.push('expected logo missing');
  return failures;
}

function reviewQueueExpression() {
  return `(() => {
    const tabs = [...document.querySelectorAll('.mobile-review-tabs button')];
    const queueTab = tabs.find((button) => button.innerText.toLowerCase().includes('queue'));
    if (queueTab && queueTab.getAttribute('aria-selected') !== 'true') {
      queueTab.click();
    }
    const root = document.documentElement;
    const text = document.body.innerText;
    const panelText = document.querySelector('.mobile-review-panel')?.innerText ?? '';
    const panel = panelText.toLowerCase();
    const selectedTab = tabs.find((button) => button.getAttribute('aria-selected') === 'true')?.innerText ?? '';
    const queueCount = Number(selectedTab.match(/\\d+/)?.[0] ?? Number.NaN);
    return {
      width: 390,
      height: 844,
      mobile: true,
      check: 'review-queue',
      selectedTab,
      queueCount: Number.isFinite(queueCount) ? queueCount : null,
      hasEmptyReviewState: panel.includes('no review records'),
      hasOfficialQueue: panel.includes('official airport code review'),
      hasPublishCount: panel.includes('publish'),
      hasManualRows: panel.includes('manual'),
      hasCandidateRow: /chase sapphire|american express|capital one|air canada|airport dimensions|escape|oneworld/i.test(panelText),
      hasMoreButton: Boolean(document.querySelector('.review-more-button')),
      queueLaneCount: document.querySelectorAll('.review-lane-grid.is-mobile-queue > span').length,
      sourceRows: document.querySelectorAll('.review-list.is-compact .review-row').length,
      actionRows: document.querySelectorAll('.review-row.is-action').length,
      hasForbiddenUiCopy: /Welcome|Get started|Discover|Powerful|Seamless|Intuitive|Unlock|Transform|All-in-one/.test(text),
      horizontalOverflow: root.scrollWidth > root.clientWidth + 1,
    };
  })()`;
}

function assertReviewQueue(result) {
  const failures = [];
  if (!result.selectedTab?.toLowerCase().includes('queue')) failures.push('review queue tab not selected');
  const isEmptyQueue = result.queueCount === 0 || result.hasEmptyReviewState;
  if (isEmptyQueue) {
    if (!result.hasEmptyReviewState) failures.push('empty review state missing');
    if (!result.hasPublishCount) failures.push('source decision counts missing');
    if (result.hasForbiddenUiCopy) failures.push('forbidden UI copy visible');
    if (result.horizontalOverflow) failures.push('horizontal overflow');
    return failures;
  }
  if (!result.hasOfficialQueue) failures.push('official queue missing');
  if (!result.hasPublishCount) failures.push('source decision counts missing');
  if (!result.hasManualRows) failures.push('manual labels missing');
  if (!result.hasCandidateRow) failures.push('manual review row missing');
  if (!result.hasMoreButton) failures.push('review more action missing');
  if (result.queueLaneCount < 3) failures.push('queue lanes missing');
  if (result.sourceRows < 3) failures.push('source decision rows missing');
  if (result.actionRows < 1) failures.push('manual row actions missing');
  if (result.hasForbiddenUiCopy) failures.push('forbidden UI copy visible');
  if (result.horizontalOverflow) failures.push('horizontal overflow');
  return failures;
}

async function runViewport({ port, baseUrl, selectedId, expectedLogo, width, height, mobile, timeoutMs }) {
  const targetUrl = `${baseUrl}/?selected=${encodeURIComponent(selectedId)}&sheet=full&mode=details`;
  const target = await createTarget(port, 'about:blank');
  const client = await connectToTarget(target.webSocketDebuggerUrl);

  try {
    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: mobile ? 3 : 1,
      mobile,
    });
    await client.send('Page.navigate', { url: targetUrl });

    const deadline = Date.now() + timeoutMs;
    let value = null;
    while (Date.now() < deadline) {
      const result = await client.send('Runtime.evaluate', {
        returnByValue: true,
        expression: browserExpression({ mobile, expectedLogo }),
      });
      value = result.result.value;
      if (value?.detailVisible && value?.visibleSearch) {
        break;
      }
      await wait(250);
    }

    return {
      width,
      height,
      mobile,
      ...value,
      failures: assertViewport(value ?? {}),
    };
  } finally {
    await client.send('Target.closeTarget', { targetId: target.id }).catch(() => undefined);
    await client.close();
  }
}

async function runMobileReviewQueue({ port, baseUrl, timeoutMs }) {
  const targetUrl = `${baseUrl}/?sheet=full&mode=review`;
  const target = await createTarget(port, 'about:blank');
  const client = await connectToTarget(target.webSocketDebuggerUrl);

  try {
    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 3,
      mobile: true,
    });
    await client.send('Page.navigate', { url: targetUrl });

    const deadline = Date.now() + timeoutMs;
    let value = null;
    while (Date.now() < deadline) {
      const result = await client.send('Runtime.evaluate', {
        returnByValue: true,
        expression: reviewQueueExpression(),
      });
      value = result.result.value;
      const queueReady = value?.hasCandidateRow || value?.queueCount === 0 || value?.hasEmptyReviewState;
      if (value?.selectedTab?.toLowerCase().includes('queue') && queueReady) {
        break;
      }
      await wait(250);
    }

    return {
      ...value,
      failures: assertReviewQueue(value ?? {}),
    };
  } finally {
    await client.send('Target.closeTarget', { targetId: target.id }).catch(() => undefined);
    await client.close();
  }
}

async function runWithChrome(options) {
  const chromeBin = findChrome(options.chromeBin);
  const port = await getFreePort();
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lounge-guru-ui-smoke-'));
  const chrome = spawn(chromeBin, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank',
  ], {
    stdio: ['ignore', 'ignore', 'pipe'],
  });

  let chromeStderr = '';
  chrome.stderr.on('data', (chunk) => {
    chromeStderr += chunk.toString();
  });

  try {
    const deadline = Date.now() + options.timeoutMs;
    await fetchJson(`http://127.0.0.1:${port}/json/version`, deadline);

    const viewports = [
      { width: 1365, height: 860, mobile: false },
      { width: 390, height: 844, mobile: true },
    ];
    const results = [];
    for (const viewport of viewports) {
      results.push(await runViewport({ port, ...options, ...viewport }));
    }
    if (options.checkReviewQueue) {
      results.push(await runMobileReviewQueue({ port, ...options }));
    }
    return results;
  } finally {
    if (!chrome.killed) {
      chrome.kill('SIGTERM');
    }
    await Promise.race([
      new Promise((resolve) => chrome.once('exit', resolve)),
      wait(1500).then(() => {
        if (chrome.exitCode === null) {
          chrome.kill('SIGKILL');
        }
      }),
    ]);
    await wait(100);
    fs.rmSync(userDataDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    if (chrome.exitCode && chrome.exitCode !== 0 && chromeStderr.trim()) {
      process.stderr.write(chromeStderr.slice(-2000));
    }
  }
}

export async function runUiSmoke({ args = process.argv.slice(2), env = process.env, log = console.log } = {}) {
  const options = parseUiSmokeArgs(args, env);
  const results = await runWithChrome(options);
  const failures = results.flatMap((result) =>
    result.failures.map((failure) =>
      `${result.check ?? (result.mobile ? 'mobile' : 'desktop')}: ${failure}`,
    ),
  );
  const summary = {
    ok: failures.length === 0,
    baseUrl: options.baseUrl,
    selectedId: options.selectedId,
    expectedLogo: options.expectedLogo,
    results,
  };

  log(JSON.stringify(summary, null, 2));

  if (failures.length > 0) {
    throw new Error(`UI smoke failed: ${failures.join(', ')}`);
  }

  return summary;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  runUiSmoke().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
