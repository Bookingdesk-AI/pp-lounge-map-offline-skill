import {
  CatalogMcpAgent,
  createHealthResponse,
  handleLegacySseRequest,
  handleMcpRequest,
  isLegacyMessageRequest,
  isLegacySseRequest,
  isStreamableMcpRequest,
} from './server.js';
import { McpRateLimiter } from './rate-limit.js';

export { CatalogMcpAgent, McpRateLimiter };

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/healthz') {
      return createHealthResponse();
    }

    if (isStreamableMcpRequest(request)) {
      return handleMcpRequest(request, env, ctx);
    }

    if (isLegacySseRequest(request) || isLegacyMessageRequest(request)) {
      return handleLegacySseRequest(request, env, ctx);
    }

    return new Response('Not Found', { status: 404 });
  },
};
