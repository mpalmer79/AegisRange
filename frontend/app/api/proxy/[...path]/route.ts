import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

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

function buildUpstreamHeaders(request: NextRequest): Headers {
  const headers = new Headers();

  for (const [key, value] of request.headers.entries()) {
    const lower = key.toLowerCase();

    if (
      lower === 'host' ||
      lower === 'connection' ||
      lower === 'content-length' ||
      lower === 'transfer-encoding' ||
      lower === 'content-encoding'
    ) {
      continue;
    }

    headers.set(key, value);
  }

  return headers;
}

async function proxy(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
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

    const responseHeaders = new Headers();

    for (const [key, value] of upstream.headers.entries()) {
      const lower = key.toLowerCase();

      if (
        lower === 'content-length' ||
        lower === 'transfer-encoding' ||
        lower === 'content-encoding'
      ) {
        continue;
      }

      responseHeaders.set(key, value);
    }

    const body = await upstream.arrayBuffer();

    return new Response(body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown proxy error';

    return Response.json(
      {
        error: 'Proxy request failed',
        detail: message,
      },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return proxy(request, context);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return proxy(request, context);
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return proxy(request, context);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return proxy(request, context);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return proxy(request, context);
}

export async function OPTIONS(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return proxy(request, context);
}

export async function HEAD(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return proxy(request, context);
}