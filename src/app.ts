import express, { Application, Request, Response, NextFunction } from 'express';
import apiRoutes from './routes/apiRoutes';

export function createApp(): Application {
  const app = express();

  // Parse raw text for XML/SOAP requests
  app.use(
    express.text({
      type: ['*/xml', '+xml', 'text/plain', 'application/soap+xml'],
      limit: '5mb',
    })
  );

  // Also support JSON and urlencoded where needed
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Basic security and request headers
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
  });

  // Mount routes
  app.use('/', apiRoutes);

  // Global 404 handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Endpoint not found' });
  });

  // Global error handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[App] Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
