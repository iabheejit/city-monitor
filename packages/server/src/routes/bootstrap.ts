import { Router } from 'express';
import type { Cache } from '../lib/cache.js';
import { getCityConfig } from '../config/index.js';
import { CK } from '../lib/cache-keys.js';

export function createBootstrapRouter(cache: Cache) {
  const router = Router();

  // Bootstrap endpoint: returns all cached city data in one response.
  // NOTE: Unlike individual routes (e.g., /news/digest, /news/summary), bootstrap
  // is cache-only with no DB fallback. If the cache is cold, slots return null.
  router.get('/:city/bootstrap', (req, res) => {
    const city = getCityConfig(req.params.city);
    if (!city) {
      res.status(404).json({ error: 'City not found' });
      return;
    }

    const data = cache.getBatchWithMeta(CK.bootstrapKeys(city.id));

    res.json({
      news: data[CK.newsDigest(city.id)] ?? null,
      weather: data[CK.weather(city.id)] ?? null,
      transit: data[CK.transitAlerts(city.id)] ?? null,
      events: data[CK.eventsUpcoming(city.id)] ?? null,
      safety: data[CK.safetyRecent(city.id)] ?? null,
      nina: data[CK.ninaWarnings(city.id)] ?? null,
      airQuality: data[CK.airQuality(city.id)] ?? null,
      pharmacies: data[CK.pharmacies(city.id)] ?? null,
      aeds: data[CK.aedLocations(city.id)] ?? null,
      traffic: data[CK.trafficIncidents(city.id)] ?? null,
      construction: data[CK.constructionSites(city.id)] ?? null,
      waterLevels: data[CK.waterLevels(city.id)] ?? null,
      budget: data[CK.budget(city.id)] ?? null,
      appointments: data[CK.appointments(city.id)] ?? null,
      laborMarket: data[CK.laborMarket(city.id)] ?? null,
      wastewater: data[CK.wastewaterSummary(city.id)] ?? null,
      populationSummary: data[CK.populationSummary(city.id)] ?? null,
      feuerwehr: data[CK.feuerwehr(city.id)] ?? null,
      pollen: data[CK.pollen(city.id)] ?? null,
      noiseSensors: data[CK.noiseSensors(city.id)] ?? null,
      councilMeetings: data[CK.councilMeetings(city.id)] ?? null,
      mandi: data[CK.mandi(city.id)] ?? null,
      mgnrega: data[CK.mgnrega(city.id)] ?? null,
      myScheme: data[CK.myScheme(city.id)] ?? null,
      cpcbAqi: data[CK.cpcbAqi(city.id)] ?? null,
      msme: data[CK.msme(city.id)] ?? null,
      hmisSubdistrict: data[CK.hmisSubdistrict(city.id)] ?? null,
      nfhs5: data[CK.nfhs5(city.id)] ?? null,
      jjm: data[CK.jjm(city.id)] ?? null,
      sfSafety: data[CK.sfSafety(city.id)] ?? null,
      sf311: data[CK.sf311(city.id)] ?? null,
      sfStreetClosures: data[CK.sfStreetClosures(city.id)] ?? null,
      sfTransitAlerts: data[CK.sfTransitAlerts(city.id)] ?? null,
      sfTrafficEvents: data[CK.sfTrafficEvents(city.id)] ?? null,
    });
  });

  return router;
}
