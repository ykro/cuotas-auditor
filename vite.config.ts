import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { handleOcrRequest } from './server.mjs';

function vertexOcrDevPlugin() {
  const middleware = (req: any, res: any, next: any) => {
    if (req.method === 'POST' && req.url?.startsWith('/api/ocr')) {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', async () => {
        try {
          const raw = Buffer.concat(chunks).toString('utf-8');
          const body = raw ? JSON.parse(raw) : {};
          const result = await handleOcrRequest(body);
          res.statusCode = result.status;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify(result.payload));
        } catch (err: any) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(
            JSON.stringify({
              error: err?.message || 'Error al procesar el OCR con Vertex AI.',
            })
          );
        }
      });
      return;
    }
    next();
  };

  return {
    name: 'vertex-ocr-api-middleware',
    configureServer(server: any) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server: any) {
      server.middlewares.use(middleware);
    },
  };
}

export default defineConfig({
  plugins: [react(), vertexOcrDevPlugin()],
  server: {
    port: 5173,
    host: true,
  },
});
