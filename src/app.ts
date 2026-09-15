import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import './config/firebase';
import healthRouter from './routes/health.routes';
import apiRouter from './routes/api.routes';

const app: Application = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// Preview admin uses Firebase Bearer auth. Echo the requesting origin when
// CORS_ORIGIN is '*' so credentialed Authorization requests are accepted by browsers.
const configuredOrigins = (process.env.CORS_ORIGIN || '*')
  .split(',').map((origin) => origin.trim()).filter(Boolean);
const corsOptions = {
  origin: (requestOrigin: string | undefined, callback: (error: Error | null, origin?: boolean | string) => void) => {
    if (!requestOrigin) return callback(null, true);
    if (configuredOrigins.includes('*') || configuredOrigins.includes(requestOrigin)) {
      return callback(null, requestOrigin);
    }
    return callback(new Error('CORS origin not allowed'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));

app.use(morgan('dev'));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use('/health', healthRouter);
app.use('/api', apiRouter);

app.get('/', (_req: Request, res: Response) => res.json({
  message: 'Welcome to Express TypeScript API',
  version: '1.0.0',
  endpoints: { health: '/health', api: '/api' },
}));

app.use((_req: Request, res: Response) => res.status(404).json({ success: false, message: 'Route not found' }));
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

export default app;
