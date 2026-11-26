import { env } from './config/env.js';
import { checkStorageHealth } from './config/storage.js';
import { createApp } from './app.js';

const app = createApp();
const storage = checkStorageHealth();

app.listen(env.PORT, () => {
  console.log(
    `[api] Mobileum Sales Demo API listening on http://localhost:${env.PORT}`,
  );
  console.log(
    `[api] Persistent media storage: ${storage.directory} (writable=${storage.writable})`,
  );
});
