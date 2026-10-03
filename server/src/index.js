import 'dotenv/config';
import { createApp } from './app.js';

const app = createApp();

const port = Number(process.env.PORT || 5000);
const server = app.listen(port, () => console.log(`Hidden Heritage API listening on http://localhost:${port}`));
server.on('error', (error) => { console.error('Server could not start:', error.message); process.exitCode = 1; });
