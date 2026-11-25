import { Router, Request, Response } from 'express';
import { SoapController } from '../controllers/soapController';
import { prisma } from '../db/prisma';

const router = Router();

// Health check endpoint
router.get('/health', async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      status: 'UP',
      timestamp: new Date().toISOString(),
      database: 'connected',
    });
  } catch (error) {
    res.status(503).json({
      status: 'DOWN',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
    });
  }
});

// Zong Reverse Flow SOAP Endpoint (handles ?wsdl query and POST XML)
router.get('/api/zong', (req: Request, res: Response) => {
  if (req.query.wsdl !== undefined || req.query.WSDL !== undefined) {
    return SoapController.handleWsdl(req, res);
  }
  return res.status(400).send('Expected ?wsdl parameter or use POST to send SOAP requests.');
});

router.post('/api/zong', SoapController.handleSoapPost);

// Admin helper endpoint to check subscriber status (useful for verification)
router.get('/api/subscribers/:msisdn', async (req: Request, res: Response) => {
  try {
    const rawMsisdn = req.params.msisdn;
    const msisdn = Array.isArray(rawMsisdn) ? rawMsisdn[0] : rawMsisdn;
    const subscriber = await prisma.subscriber.findUnique({
      where: { msisdn },
    });

    if (!subscriber) {
      return res.status(404).json({ message: 'Subscriber not found' });
    }

    return res.status(200).json(subscriber);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to retrieve subscriber' });
  }
});

export default router;
