import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const goal = JSON.parse(fs.readFileSync(new URL('../public/data/product-goal.json', import.meta.url), 'utf8'));
const sourceRegistry = JSON.parse(fs.readFileSync(new URL('../public/data/source-registry.json', import.meta.url), 'utf8'));

test('product goal defines the Lounge Guru north star and guardrails', () => {
  assert.equal(goal.product, 'Lounge Guru');
  assert.match(goal.positioning, /ExpertFlyer-grade/);
  assert.equal(goal.policy.sourceMode, 'official_public_first');
  assert.equal(goal.policy.rawScraping, 'disallowed');
  assert.equal(goal.policy.copy, 'concise_task_text_only');
});

test('product goal keeps required desktop and mobile workflows in scope', () => {
  assert.ok(goal.workflows.desktop.includes('left_rail_results_filters_compare'));
  assert.ok(goal.workflows.desktop.includes('right_detail_panel'));
  assert.ok(goal.workflows.mobile.includes('compare_sheet'));
  assert.ok(goal.workflows.mobile.includes('review_sheet'));
});

test('product goal source priorities are represented in the source registry', () => {
  const sourceIds = new Set(sourceRegistry.map((source) => source.id));
  for (const sourceId of goal.sourcePriorities) {
    assert.ok(sourceIds.has(sourceId), `missing source priority ${sourceId}`);
  }
});

test('product goal forbids marketing-heavy production aesthetics', () => {
  for (const phrase of ['hero_sections', 'marketing_copy', 'intro_paragraphs', 'redundant_helper_text']) {
    assert.ok(goal.aesthetic.avoid.includes(phrase));
  }
});
