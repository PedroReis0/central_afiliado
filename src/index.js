import './env.js';
import Fastify from 'fastify';
import { registerWebhookRoutes } from './routes/webhook.js';
import { registerScraperRoutes } from './routes/scraper.js';
import { registerCatalogRoutes } from './routes/catalogo.js';
import { registerPipelineRoutes } from './routes/pipeline.js';
import { registerProdutosRoutes } from './routes/produtos.js';

const app = Fastify({
  logger: true
});

registerWebhookRoutes(app);
registerScraperRoutes(app);
registerCatalogRoutes(app);
registerPipelineRoutes(app);
registerProdutosRoutes(app);

const port = Number(process.env.PORT || 3000);

app.listen({ port, host: '0.0.0.0' })
  .then(() => {
    app.log.info(`Server listening on ${port}`);
  })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
