import { Router, Request, Response } from 'express';
import { register } from '../lib/metrics';

const router = Router();

/**
 * @swagger
 * /metrics:
 *   get:
 *     summary: Prometheus metrics endpoint
 *     tags: [Monitoring]
 *     description: Returns metrics in Prometheus format for scraping
 *     responses:
 *       200:
 *         description: Metrics data in Prometheus format
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    // Set content type for Prometheus
    res.setHeader('Content-Type', register.contentType);

    // Return all metrics
    const metrics = await register.metrics();
    res.send(metrics);
  } catch {
    res.status(500).send('Error collecting metrics');
  }
});

export default router;
