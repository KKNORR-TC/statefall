'use strict';

const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {chromium, devices} = require('playwright');
const {createServer: createViteServer} = require('vite');
const ceilings = require('../tests/fixtures/browser-performance-ceilings.json');

const root = path.resolve(__dirname, '..');
const output = path.resolve(root, process.env.STATEFALL_PERF_OUTPUT || '.artifacts/browser-performance/baseline.json');
const sampleCount = Math.max(1, Number.parseInt(process.env.STATEFALL_PERF_SAMPLES || '3', 10));
const scenarios = [
  {name: 'desktop-1440x900', context: {viewport: {width: 1440, height: 900}, deviceScaleFactor: 1}},
  {name: 'mobile-pixel-7-390x844', context: {...devices['Pixel 7'], viewport: {width: 390, height: 844}}}
];

function percentile(values, fraction) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)];
}

function summarize(values) {
  return {median: percentile(values, 0.5), p95: percentile(values, 0.95), max: Math.max(...values)};
}

async function collectSample(browser, baseURL, scenario) {
  const context = await browser.newContext(scenario.context);
  const page = await context.newPage();
  const session = await context.newCDPSession(page);
  const failures = [];
  page.on('pageerror', error => failures.push(`page error: ${error.stack || error.message}`));
  page.on('console', message => {
    if (message.type() === 'error') failures.push(`console error: ${message.text()}`);
  });
  page.on('requestfailed', request => failures.push(`request failed: ${request.method()} ${request.url()} (${request.failure()?.errorText || 'unknown'})`));
  page.on('response', response => {
    if (response.status() >= 400) failures.push(`HTTP ${response.status()}: ${response.url()}`);
  });

  await session.send('Network.enable');
  await session.send('Network.setCacheDisabled', {cacheDisabled: true});
  await page.addInitScript(() => {
    window.__STATEFALL_TEST_MODE__ = true;
    localStorage.setItem('statefall-audio', JSON.stringify({master: 0, sfx: 0, alert: 0, amb: 0, music: 0}));
  });

  try {
    await page.goto(`${baseURL}/index.html?browserTest=1`, {waitUntil: 'load'});
    await page.locator('#maps button[data-m="random"]').click();
    await page.locator('#seedIn').fill('PHASEAPERF');
    await page.locator('#countrySel').selectOption('0');

    const started = await page.evaluate(() => {
      window.__STATEFALL_TEST__.prepareControlledStart();
      const before = performance.now();
      document.querySelector('#startBtn').click();
      const after = performance.now();
      return {startToReadyMs: after - before, ready: window.__STATEFALL_TEST__.status().ready};
    });
    if (!started.ready) throw new Error('test bridge did not report a ready match');

    const navigation = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0];
      const entries = [nav, ...performance.getEntriesByType('resource')].filter(Boolean);
      return {
        coldLoadMs: nav.duration,
        resources: {
          count: entries.length,
          transferBytes: entries.reduce((sum, entry) => sum + (entry.transferSize || 0), 0),
          encodedBytes: entries.reduce((sum, entry) => sum + (entry.encodedBodySize || 0), 0),
          decodedBytes: entries.reduce((sum, entry) => sum + (entry.decodedBodySize || 0), 0)
        },
        jsHeapSizeLimitBytes: performance.memory?.jsHeapSizeLimit || null,
        usedJSHeapSizeBytes: performance.memory?.usedJSHeapSize || null
      };
    });

    const simulation = await page.evaluate(async () => {
      const before = performance.now();
      const status = window.__STATEFALL_TEST__.advance(300);
      const elapsed = performance.now() - before;
      return {ticks: status.tick, elapsedMs: elapsed, digest: await window.__STATEFALL_TEST__.canonicalDigest()};
    });

    await page.evaluate(() => window.__STATEFALL_TEST__.freezePresentation());
    await page.waitForTimeout(50);
    const frameTimes = await page.evaluate(() => {
      const samples = [];
      for (let i = 0; i < 20; i++) {
        const before = performance.now();
        window.__STATEFALL_TEST__.freezePresentation();
        samples.push(performance.now() - before);
      }
      return samples;
    });

    await session.send('HeapProfiler.collectGarbage');
    const heap = await session.send('Runtime.getHeapUsage');
    const result = {
      coldLoadMs: navigation.coldLoadMs,
      startToReadyMs: started.startToReadyMs,
      coldLoadAndStartToReadyMs: navigation.coldLoadMs + started.startToReadyMs,
      simulation300TicksMs: simulation.elapsedMs,
      simulationTick: simulation.ticks,
      simulationDigest: simulation.digest,
      renderedFrameMs: summarize(frameTimes),
      resources: navigation.resources,
      heap: {
        cdpUsedBytes: heap.usedSize,
        cdpTotalBytes: heap.totalSize,
        performanceUsedBytes: navigation.usedJSHeapSizeBytes,
        jsHeapSizeLimitBytes: navigation.jsHeapSizeLimitBytes
      },
      failures
    };
    if (failures.length) throw new Error(failures.join('\n'));
    return result;
  } finally {
    await context.close();
  }
}

function summarizeScenario(samples) {
  const scalar = key => summarize(samples.map(sample => sample[key]));
  return {
    coldLoadMs: scalar('coldLoadMs'),
    startToReadyMs: scalar('startToReadyMs'),
    coldLoadAndStartToReadyMs: scalar('coldLoadAndStartToReadyMs'),
    simulation300TicksMs: scalar('simulation300TicksMs'),
    renderedFrameP95Ms: summarize(samples.map(sample => sample.renderedFrameMs.p95)),
    resourceTransferBytes: summarize(samples.map(sample => sample.resources.transferBytes)),
    resourceDecodedBytes: summarize(samples.map(sample => sample.resources.decodedBytes)),
    cdpUsedHeapBytes: summarize(samples.map(sample => sample.heap.cdpUsedBytes))
  };
}

function evaluateCeilings(summary) {
  const checks = [];
  for (const [scenario, metrics] of Object.entries(ceilings.scenarios)) {
    for (const [metric, rule] of Object.entries(metrics)) {
      const actual = summary[scenario]?.[metric]?.[rule.stat];
      checks.push({scenario, metric, stat: rule.stat, actual, ceiling: rule.ceiling, passed: Number.isFinite(actual) && actual <= rule.ceiling});
    }
  }
  return checks;
}

async function main() {
  const server = await createViteServer({configFile:path.join(root,'vite.config.js'),server:{host:'127.0.0.1',port:0}});
  await server.listen();
  const baseURL = server.resolvedUrls.local[0].replace(/\/$/,'');
  const browser = await chromium.launch();
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    environment: {
      platform: process.platform,
      release: os.release(),
      arch: process.arch,
      node: process.version,
      browser: `chromium ${browser.version()}`,
      headless: true,
      samplesPerScenario: sampleCount
    },
    scenarios: {},
    summary: {},
    ceilingChecks: [],
    passed: false
  };

  try {
    for (const scenario of scenarios) {
      process.stdout.write(`Measuring ${scenario.name} (${sampleCount} cold samples)...\n`);
      report.scenarios[scenario.name] = [];
      for (let index = 0; index < sampleCount; index++) report.scenarios[scenario.name].push(await collectSample(browser, baseURL, scenario));
      report.summary[scenario.name] = summarizeScenario(report.scenarios[scenario.name]);
    }
    const digests = new Set(Object.values(report.scenarios).flat().map(sample => sample.simulationDigest));
    report.deterministic = digests.size === 1;
    report.ceilingChecks = evaluateCeilings(report.summary);
    report.passed = report.deterministic && report.ceilingChecks.every(check => check.passed);
  } finally {
    await browser.close();
    await server.close();
    await fs.mkdir(path.dirname(output), {recursive: true});
    await fs.writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
  }

  for (const [name, summary] of Object.entries(report.summary)) {
    process.stdout.write(`${name}: load ${summary.coldLoadMs.median.toFixed(1)} ms, start ${summary.startToReadyMs.median.toFixed(1)} ms, 300 ticks ${summary.simulation300TicksMs.median.toFixed(1)} ms, frame p95 ${summary.renderedFrameP95Ms.median.toFixed(1)} ms, transfer ${summary.resourceTransferBytes.median} B, heap ${summary.cdpUsedHeapBytes.median} B\n`);
  }
  const failed = report.ceilingChecks.filter(check => !check.passed);
  if (!report.deterministic) failed.push({scenario: 'all', metric: 'simulationDigest', actual: 'mismatch', ceiling: 'one digest'});
  process.stdout.write(`Report: ${path.relative(root, output)}\n`);
  if (failed.length) throw new Error(`Performance baseline failed:\n${failed.map(check => `${check.scenario} ${check.metric}: ${check.actual} > ${check.ceiling}`).join('\n')}`);
}

main().catch(error => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
