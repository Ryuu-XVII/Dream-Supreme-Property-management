import * as cheerio from 'cheerio';

const ALLOWED_HOSTS = new Set(['property24.com', 'www.property24.com']);
const DEFAULT_DELAY_MS = 750;
const MAX_ALLOWED_PAGES = 25;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const clean = (value = '') => value.replace(/\s+/g, ' ').trim();

function validateProperty24Url(input) {
  let url;
  try {
    url = new URL(input);
  } catch {
    throw new Error('Invalid URL.');
  }

  if (url.protocol !== 'https:') {
    throw new Error('Only https:// Property24 URLs are allowed.');
  }
  if (!ALLOWED_HOSTS.has(url.hostname.toLowerCase())) {
    throw new Error('URL must be on property24.com.');
  }
  return url;
}

export function parseAgentProfileUrl(input) {
  const url = validateProperty24Url(input);
  const parts = url.pathname.split('/').filter(Boolean);

  if (parts.length < 4 || parts[0] !== 'estate-agents') {
    throw new Error(
      'Expected a Property24 agent profile URL like /estate-agents/{agency}/{agent}/{id}.'
    );
  }

  const agencySlug = parts[1];
  const agentSlug = parts[2];
  const agentId = parts[3];

  if (!/^\d+$/.test(agentId)) {
    throw new Error('Could not find a numeric Property24 agent ID in the URL.');
  }

  const origin = 'https://www.property24.com';
  const suffix = `${agencySlug}/${agentSlug}/${agentId}`;

  return {
    agencySlug,
    agentSlug,
    agentId,
    profileUrl: `${origin}/estate-agents/${suffix}`,
    saleUrl: `${origin}/for-sale/agency/${suffix}`,
    rentUrl: `${origin}/to-rent/agency/${suffix}`,
  };
}

async function fetchHtml(url, { retries = 2 } = {}) {
  validateProperty24Url(url);

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const response = await fetch(url, {
      redirect: 'follow',
      headers: {
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/124.0 Safari/537.36 Property24AgentSync/1.0',
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'accept-language': 'en-ZA,en;q=0.9',
      },
      signal: AbortSignal.timeout(20_000),
    });

    const finalUrl = validateProperty24Url(response.url);
    void finalUrl;

    if (response.ok) return response.text();

    // Respect blocks: do not attempt to work around 401/403/CAPTCHA responses.
    if (response.status === 401 || response.status === 403) {
      throw new Error(`Property24 refused the request (HTTP ${response.status}).`);
    }

    if (![429, 500, 502, 503, 504].includes(response.status) || attempt === retries) {
      throw new Error(`Property24 returned HTTP ${response.status} for ${url}`);
    }

    const retryAfter = Number(response.headers.get('retry-after'));
    const delay = Number.isFinite(retryAfter) && retryAfter > 0
      ? retryAfter * 1000
      : 1000 * (attempt + 1);
    await sleep(delay);
  }

  throw new Error(`Unable to fetch ${url}`);
}

function listingUrlInfo(href, baseUrl) {
  if (!href) return null;

  let url;
  try {
    url = new URL(href, baseUrl);
  } catch {
    return null;
  }

  if (!ALLOWED_HOSTS.has(url.hostname.toLowerCase())) return null;

  const parts = url.pathname.split('/').filter(Boolean);
  const purpose = parts[0];

  if (!['for-sale', 'to-rent'].includes(purpose)) return null;
  if (parts.includes('agency')) return null;
  if (parts.length < 6) return null;

  const listingId = parts.at(-1);
  if (!/^\d{7,}$/.test(listingId)) return null;

  url.search = '';
  url.hash = '';

  return {
    url: url.toString(),
    listingId,
    purpose: purpose === 'for-sale' ? 'sale' : 'rent',
  };
}

function chooseCard($, anchor) {
  let node = $(anchor);
  let best = node;

  for (let i = 0; i < 7; i += 1) {
    const parent = node.parent();
    if (!parent.length) break;

    const text = clean(parent.text());
    const listingLinkCount = parent
      .find('a[href]')
      .toArray()
      .filter((a) => listingUrlInfo($(a).attr('href'), 'https://www.property24.com')).length;

    if (text.length >= 20 && text.length <= 1200 && listingLinkCount <= 3) {
      best = parent;
    }

    // Once the container includes useful imagery/metadata, it is usually the card.
    if (best.find('img').length > 0 && text.length >= 35) break;
    node = parent;
  }

  return best;
}

function numberNearImage($, card, altPattern) {
  let value = null;

  card.find('img[alt]').each((_, img) => {
    if (value !== null) return;
    const alt = clean($(img).attr('alt'));
    if (!altPattern.test(alt)) return;

    const candidates = [
      clean($(img).parent().text()),
      clean($(img).parent().parent().text()),
      clean($(img).next().text()),
    ];

    for (const candidate of candidates) {
      const match = candidate.match(/\b(\d+(?:\.\d+)?)\b/);
      if (match) {
        value = Number(match[1]);
        return;
      }
    }
  });

  return value;
}

function floorSizeNearImage($, card) {
  let value = null;

  card.find('img[alt]').each((_, img) => {
    if (value !== null) return;
    const alt = clean($(img).attr('alt'));
    if (!/floor\s*size|size/i.test(alt)) return;

    const text = clean($(img).parent().parent().text());
    const match = text.match(/([\d\s,.]+)\s*m²/i);
    if (match) value = clean(match[1]) + ' m²';
  });

  return value;
}

function imageFromCard($, card, listingId) {
  const images = card.find('img').toArray();

  const preferred = images.find((img) => {
    const alt = clean($(img).attr('alt'));
    const src = $(img).attr('src') || $(img).attr('data-src') || '';
    return alt.includes(listingId) || src.includes(listingId);
  });

  const image = preferred || images.find((img) => {
    const src = $(img).attr('src') || $(img).attr('data-src') || '';
    return /images\.prop24\.com/i.test(src);
  });

  if (!image) return null;

  const raw =
    $(image).attr('src') ||
    $(image).attr('data-src') ||
    $(image).attr('data-original') ||
    null;

  if (!raw) return null;
  try {
    return new URL(raw, 'https://www.property24.com').toString();
  } catch {
    return null;
  }
}

function parseListingCard($, anchor, baseUrl) {
  const info = listingUrlInfo($(anchor).attr('href'), baseUrl);
  if (!info) return null;

  const card = chooseCard($, anchor);
  const anchorText = clean($(anchor).text());
  const rawText = clean(card.text());

  const priceMatch = rawText.match(/\bR\s*[\d][\d\s,.]*/i);
  const bedroomTitleMatch = rawText.match(/(\d+(?:\.\d+)?)\s+Bedroom\s+([^|]+?)(?=\s{2,}|$)/i);

  const title = clean(
    $(anchor).attr('title') ||
      card.find('h1,h2,h3,h4,h5').first().text() ||
      (bedroomTitleMatch ? bedroomTitleMatch[0] : anchorText)
  );

  return {
    id: info.listingId,
    purpose: info.purpose,
    url: info.url,
    price: priceMatch ? clean(priceMatch[0]) : null,
    title: title || null,
    imageUrl: imageFromCard($, card, info.listingId),
    bedrooms: numberNearImage($, card, /bedroom/i),
    bathrooms: numberNearImage($, card, /bathroom/i),
    garages: numberNearImage($, card, /garage/i),
    parking: numberNearImage($, card, /parking/i),
    floorSize: floorSizeNearImage($, card),
    summary: rawText || anchorText || null,
  };
}

function nextPageUrl($, currentUrl, agent) {
  const candidates = [];

  $('link[rel="next"]').each((_, el) => candidates.push($(el).attr('href')));
  $('a[href]').each((_, el) => {
    const text = clean($(el).text()).toLowerCase();
    const aria = clean($(el).attr('aria-label')).toLowerCase();
    if (text === 'next' || aria === 'next' || aria.includes('next page')) {
      candidates.push($(el).attr('href'));
    }
  });

  for (const href of candidates) {
    if (!href) continue;
    try {
      const url = new URL(href, currentUrl);
      if (!ALLOWED_HOSTS.has(url.hostname.toLowerCase())) continue;
      if (!url.pathname.includes(`/agency/${agent.agencySlug}/${agent.agentSlug}/${agent.agentId}`)) {
        continue;
      }
      return url.toString();
    } catch {
      // Ignore malformed candidate links.
    }
  }

  return null;
}

async function scrapeFeed(startUrl, agent, { maxPages, delayMs }) {
  const results = new Map();
  const visited = new Set();
  let pageUrl = startUrl;
  let pagesFetched = 0;

  while (pageUrl && pagesFetched < maxPages && !visited.has(pageUrl)) {
    visited.add(pageUrl);
    const html = await fetchHtml(pageUrl);
    const $ = cheerio.load(html);
    pagesFetched += 1;

    $('a[href]').each((_, anchor) => {
      const listing = parseListingCard($, anchor, pageUrl);
      if (listing && !results.has(listing.id)) results.set(listing.id, listing);
    });

    pageUrl = nextPageUrl($, pageUrl, agent);
    if (pageUrl && pagesFetched < maxPages) await sleep(delayMs);
  }

  return { listings: [...results.values()], pagesFetched };
}

export async function scrapeAgentListings(agentUrl, options = {}) {
  const agent = parseAgentProfileUrl(agentUrl);
  const include = Array.isArray(options.include) && options.include.length
    ? options.include
    : ['sale', 'rent'];
  const maxPages = Math.min(
    Math.max(Number(options.maxPages) || 10, 1),
    MAX_ALLOWED_PAGES
  );
  const delayMs = Math.max(Number(options.delayMs) || DEFAULT_DELAY_MS, 250);

  const all = [];
  const stats = { salePagesFetched: 0, rentPagesFetched: 0 };

  if (include.includes('sale')) {
    const sale = await scrapeFeed(agent.saleUrl, agent, { maxPages, delayMs });
    all.push(...sale.listings);
    stats.salePagesFetched = sale.pagesFetched;
  }

  if (include.includes('sale') && include.includes('rent')) await sleep(delayMs);

  if (include.includes('rent')) {
    const rent = await scrapeFeed(agent.rentUrl, agent, { maxPages, delayMs });
    all.push(...rent.listings);
    stats.rentPagesFetched = rent.pagesFetched;
  }

  const listings = [...new Map(all.map((item) => [item.id, item])).values()];

  return {
    source: 'Property24',
    scrapedAt: new Date().toISOString(),
    agent: {
      id: agent.agentId,
      slug: agent.agentSlug,
      agencySlug: agent.agencySlug,
      profileUrl: agent.profileUrl,
    },
    counts: {
      total: listings.length,
      sale: listings.filter((x) => x.purpose === 'sale').length,
      rent: listings.filter((x) => x.purpose === 'rent').length,
    },
    stats,
    listings,
  };
}
