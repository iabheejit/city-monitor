import type { RequestHandler } from 'express';
import { getCityConfig } from '../config/index.js';

const CITY_ID_PATTERN = /^[a-z][a-z0-9-]{0,30}$/;

/**
 * Middleware that validates the :city route parameter.
 * Returns 400 for invalid format, 404 for unknown city.
 */
export const validateCity: RequestHandler = (req, res, next) => {
  const cityId = req.params.city as string | undefined;
  if (!cityId) {
    next();
    return;
  }

  if (!CITY_ID_PATTERN.test(cityId)) {
    res.status(400).json({ error: 'Invalid city ID format' });
    return;
  }

  if (!getCityConfig(cityId)) {
    res.status(404).json({ error: 'City not found' });
    return;
  }

  next();
};
