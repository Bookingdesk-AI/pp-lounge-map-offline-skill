import { createHealthResponse, handleMcpRequest } from './server.js';
import { McpRateLimiter } from './rate-limit.js';

export { McpRateLimiter };

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/healthz') {
      return createHealthResponse();
    }

    if (url.pathname === '/mcp') {
      return handleMcpRequest(request, env, ctx);
    }

    return new Response('Not Found', { status: 404 });
  },
};
