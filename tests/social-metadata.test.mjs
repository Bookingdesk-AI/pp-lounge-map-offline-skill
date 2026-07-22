import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const indexHtml = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const previewCard = fs.readFileSync(new URL('../public/preview-card.png', import.meta.url));

test('social metadata uses the production domain and complete large-image fields', () => {
  const requiredMarkup = [
    '<link rel="canonical" href="https://loungeguru.desk.travel/" />',
    '<meta property="og:type" content="website" />',
    '<meta property="og:site_name" content="Lounge Guru" />',
    '<meta property="og:url" content="https://loungeguru.desk.travel/" />',
    '<meta property="og:image" content="https://loungeguru.desk.travel/preview-card.png" />',
    '<meta property="og:image:width" content="1200" />',
    '<meta property="og:image:height" content="630" />',
    '<meta property="og:image:alt"',
    '<meta name="twitter:card" content="summary_large_image" />',
    '<meta name="twitter:image" content="https://loungeguru.desk.travel/preview-card.png" />',
    '<meta name="twitter:image:alt"',
  ];

  for (const markup of requiredMarkup) {
    assert.ok(indexHtml.includes(markup), `Missing social metadata: ${markup}`);
  }
  assert.doesNotMatch(indexHtml, /loungeguru-desk-travel\.pages\.dev/);
});

test('social preview image is a 1200 by 630 PNG', () => {
  assert.deepEqual([...previewCard.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(previewCard.readUInt32BE(16), 1200);
  assert.equal(previewCard.readUInt32BE(20), 630);
});
