import fs from 'fs';
import { createApp } from './app';
import { env } from './config/env';
import { storageRoot } from './lib/storage';

fs.mkdirSync(storageRoot(), { recursive: true });

const app = createApp();

app.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`🚀 Dayflow API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
});