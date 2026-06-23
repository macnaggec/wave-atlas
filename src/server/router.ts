import { router } from 'server/trpc';
import { spotsRouter } from './routes/spots';
import { mediaRouter } from './routes/media';
import { usersRouter } from './routes/users';
import { checkoutRouter } from './routes/checkout';
import { sessionsRouter } from './routes/sessions';
import { uploadsRouter } from './routes/uploads';

export const appRouter = router({
  spots: spotsRouter,
  media: mediaRouter,
  users: usersRouter,
  checkout: checkoutRouter,
  sessions: sessionsRouter,
  uploads: uploadsRouter,
});

export type AppRouter = typeof appRouter;
