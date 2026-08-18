import express from 'express';
import { scrapeAgentListings } from './property24.js';

const app = express();
app.use(express.json({ limit: '32kb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/scrape', async (req, res) => {
  try {
    const { agentUrl, include, maxPages, delayMs } = req.body || {};

    if (!agentUrl) {
      return res.status(400).json({ error: 'agentUrl is required.' });
    }

    const data = await scrapeAgentListings(agentUrl, {
      include,
      maxPages,
      delayMs,
    });

    return res.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(502).json({ error: message });
  }
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`Property24 Agent Sync listening on http://localhost:${port}`);
});
