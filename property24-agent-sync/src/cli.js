import { scrapeAgentListings } from './property24.js';

const agentUrl = process.argv[2];
if (!agentUrl) {
  console.error('Usage: npm run scrape -- "https://www.property24.com/estate-agents/..."');
  process.exit(1);
}

try {
  const result = await scrapeAgentListings(agentUrl);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
