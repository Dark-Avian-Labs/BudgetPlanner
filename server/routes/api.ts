import { Router, type Request, type Response } from 'express';
import { rateLimit } from 'express-rate-limit';

import { APP_NAME } from '../config.js';
import { invitesRouter, meRouter, plansRouter } from './plans.js';

export const apiRouter = Router();

apiRouter.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 600,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

apiRouter.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', app: APP_NAME });
});

apiRouter.get('/csrf', (req: Request, res: Response) => {
  const token = (res.locals as { csrfToken?: string }).csrfToken ?? req.session.csrfToken;
  res.json({ csrfToken: token ?? '' });
});

apiRouter.use('/me', meRouter);
apiRouter.use('/plans', plansRouter);
apiRouter.use('/invites', invitesRouter);
