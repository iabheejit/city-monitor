/**
 * Copyright (C) 2026 Odin Mühlenbein
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { createApp } from './app.js';
import { createLogger } from './lib/logger.js';

const log = createLogger('server');
const { app } = await createApp();
const port = Number(process.env.PORT) || 3001;

app.listen(port, () => {
  log.info(`listening on port ${port}`);
});
