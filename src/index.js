import './env.js';
import Fastify from 'fastify';
import { registerWebhookRoutes } from './routes/webhook.js';
import { registerScraperRoutes } from './routes/scraper.js';
import { registerCatalogRoutes } from './routes/catalogo.js';
import { registerPipelineRoutes } from './routes/pipeline.js';
import { registerProdutosRoutes } from './routes/produtos.js';
import { registerMediaRoutes } from './routes/media.js';
import { registerInstanciasRoutes } from './routes/instancias.js';
import { registerGruposRoutes } from './routes/grupos.js';
import { registerTemplatesRoutes } from './routes/templates.js';
import { registerDispatcherRoutes } from './routes/dispatcher.js';
import { registerCuponsRoutes } from './routes/cupons.js';
import { registerDashboardRoutes } from './routes/dashboard.js';
import { registerMonitorRoutes } from './routes/monitor.js';
import { registerProdutosAdminRoutes } from './routes/produtos_admin.js';
import { registerApiV1Routes } from './routes/api_v1.js';

const app = Fastify({
  logger: true
});

const corsOrigin = process.env.CORS_ORIGIN || '*';
app.addHook('onSend', async (request, reply, payload) => {
  reply.header('Access-Control-Allow-Origin', corsOrigin);
  reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Correlation-Id');
  reply.header('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
  return payload;
});

app.options('/*', async (request, reply) => reply.code(204).send());

registerWebhookRoutes(app);
registerScraperRoutes(app);
registerCatalogRoutes(app);
registerPipelineRoutes(app);
registerProdutosRoutes(app);
registerMediaRoutes(app);
registerInstanciasRoutes(app);
registerGruposRoutes(app);
registerTemplatesRoutes(app);
registerDispatcherRoutes(app);
registerCuponsRoutes(app);
registerDashboardRoutes(app);
registerMonitorRoutes(app);
registerProdutosAdminRoutes(app);
registerApiV1Routes(app);

const port = Number(process.env.PORT || 3000);

app.listen({ port, host: '0.0.0.0' })
  .then(() => {
    app.log.info(`Server listening on ${port}`);
  })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });


