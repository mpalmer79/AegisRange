import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{
    path: string[];
  }>;
};

function getBackendUrl(): string {
  const url = process.env.BACKEND_URL;

  if (!url || !url.trim()) {
    throw new Error('BACKEND_URL is not set');
  }

  return url.replace(/\/+$/, '');
}

function buildTargetUrl(path: string[], request: NextRequest): string {
  const backend = getBackendUrl();
  const joinedPath = path.join('/');
  const search = request.nextUrl.search || '';
  return `${backend}/${joinedPath}${search}`;
}

const ALLOWED_REQUEST_HEADERS = new Set([
  'content-type',
  'accept',
  'authorization',
  'x-correlation-id',
  'x-csrf-token',
  'cookie',
]);

const ALLOWED_RESPONSE_HEADERS = new Set([
  'content-type',
  'x-correlation-id',
  'x-response-time-ms',
  'x-content-type-options',
  'x-frame-options',
  'referrer-policy',
  'strict-transport-security',
  'content-security-policy',
  'cache-control',
  'retry-after',
]);

function buildUpstreamHeaders(request: NextRequest): Headers {
  const headers = new Headers();

  request.headers.forEach((value, key) => {
    const lower = key.toLowerCase();

    if (ALLOWED_REQUEST_HEADERS.has(lower)) {
      headers.set(key, value);
    }
  });

  return headers;
}

function appendSetCookieHeaders(target: Headers, upstream: Response): void {
  const headersWithOptionalGetSetCookie = upstream.headers as Headers & {
    getSetCookie?: () => string[];
  };

  if (typeof headersWithOptionalGetSetCookie.getSetCookie === 'function') {
    const cookies = headersWithOptionalGetSetCookie.getSetCookie();

    for (const cookie of cookies) {
      target.append('set-cookie', cookie);
    }

    return;
  }

  const singleCookie = upstream.headers.get('set-cookie');

  if (singleCookie) {
    target.append('set-cookie', singleCookie);
  }
}

function buildDownstreamHeaders(upstream: Response): Headers {
  const headers = new Headers();

  upstream.headers.forEach((value, key) => {
    const lower = key.toLowerCase();

    if (lower === 'set-cookie') {
      return;
    }

    if (ALLOWED_RESPONSE_HEADERS.has(lower)) {
      headers.set(key, value);
    }
  });

  appendSetCookieHeaders(headers, upstream);

  return headers;
}

async function proxy(
  request: NextRequest,
  context: RouteContext
): Promise<Response> {
  try {
    const { path } = await context.params;
    const targetUrl = buildTargetUrl(path, request);
    const headers = buildUpstreamHeaders(request);

    const init: RequestInit = {
      method: request.method,
      headers,
      redirect: 'manual',
      cache: 'no-store',
    };

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      init.body = await request.arrayBuffer();
    }

    const upstream = await fetch(targetUrl, init);
    const responseHeaders = buildDownstreamHeaders(upstream);
    const body = await upstream.arrayBuffer();

    return new Response(body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } catch {
    return Response.json(
      { error: 'Proxy request failed' },
      { status: 502 }
    );
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}

export async function OPTIONS(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}

export async function HEAD(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}
