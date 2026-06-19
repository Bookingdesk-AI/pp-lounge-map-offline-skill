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
import {
  createSourceIntakeBatchResponse,
  createSourceIntakeProbeResponse,
  createSourceIntakeReportResponse,
  createSourceIntakeStatusResponse,
} from './source-intake.js';

export { CatalogMcpAgent, McpRateLimiter };

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/healthz') {
      return createHealthResponse();
    }

    if (url.pathname === '/admin/source-intake/probe') {
      return createSourceIntakeProbeResponse(request, env);
    }

    if (url.pathname === '/admin/source-intake/probe-batch') {
      return createSourceIntakeBatchResponse(request, env);
    }

    if (url.pathname === '/admin/source-intake/status') {
      return createSourceIntakeStatusResponse(request, env);
    }

    if (url.pathname === '/admin/source-intake/report') {
      return createSourceIntakeReportResponse(request, env);
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
