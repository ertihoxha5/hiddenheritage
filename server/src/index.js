import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import healthRoutes from './routes/health.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use('/api', healthRoutes);
app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));
app.use(errorHandler);

const port = Number(process.env.PORT || 5000);
const server = app.listen(port, () => console.log(`Hidden Heritage API listening on http://localhost:${port}`));
server.on('error', (error) => { console.error('Server could not start:', error.message); process.exitCode = 1; });
