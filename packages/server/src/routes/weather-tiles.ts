import { Router } from 'express';
import { createLogger } from '../lib/logger.js';

const log = createLogger('route:weather-tiles');

const RAINVIEWER_API = 'https://api.rainviewer.com/public/weather-maps.json';
const TILE_HOST = 'https://tilecache.rainviewer.com';
const REFRESH_MS = 5 * 60 * 1000; // 5 minutes

let radarPath: string | null = null;
let refreshTimer: ReturnType<typeof setInterval> | null = null;

interface RainViewerResponse {
  radar: { past: { path: string }[] };
}

async function refreshRadarPath() {
  try {
    const res = await fetch(RAINVIEWER_API);
    if (!res.ok) return;
    const data: RainViewerResponse = await res.json();
    const past = data.radar?.past;
    if (past?.length) {
      radarPath = past[past.length - 1].path;
    }
  } catch (err) {
    log.error('Failed to refresh RainViewer radar path', err);
  }
}

export function createWeatherTilesRouter() {
  const router = Router();

  // Start background refresh
  refreshRadarPath();
  if (!refreshTimer) {
    refreshTimer = setInterval(refreshRadarPath, REFRESH_MS);
  }

  router.get('/weather-tiles/:z/:x/:y.png', async (req, res) => {
    if (!radarPath) {
      res.status(503).json({ error: 'Radar data not available yet' });
      return;
    }

    const z = Number(req.params.z);
    const x = Number(req.params.x);
    const y = Number(req.params.y);
    const maxCoord = Math.pow(2, z);

    if (
      !Number.isInteger(z) || !Number.isInteger(x) || !Number.isInteger(y) ||
      z < 0 || z > 7 || x < 0 || y < 0 || // RainViewer free tier: max zoom 7
      x >= maxCoord || y >= maxCoord
    ) {
      res.status(400).json({ error: 'Invalid tile coordinates' });
      return;
    }

    const url = `${TILE_HOST}${radarPath}/256/${z}/${x}/${y}/2/0_0.png`;

    try {
      const upstream = await fetch(url);
      if (!upstream.ok) {
        log.error(`RainViewer tile ${z}/${x}/${y} returned ${upstream.status}`);
        res.status(502).json({ error: 'Upstream tile fetch failed' });
        return;
      }

      const buffer = Buffer.from(await upstream.arrayBuffer());
      res.set('Content-Type', 'image/png');
      res.set('Cache-Control', 'public, max-age=300');
      res.send(buffer);
    } catch (err) {
      log.error(`RainViewer tile ${z}/${x}/${y} fetch error`, err);
      res.status(502).json({ error: 'Upstream tile fetch failed' });
    }
  });

  return router;
}
