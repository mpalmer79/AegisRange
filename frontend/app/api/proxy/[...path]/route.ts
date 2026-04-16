import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

function getBackendUrl(): string {
  const url = process.env.BACKEND_URL;
  if (!url) throw new Error('BACKEND_URL is not set');
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

  request.headers.forEach((value, key) => {
    headers.set(key, value);
  });

  return headers;
}

function appendSetCookieHeaders(target: Headers, upstream: Response): void {
  const headersWithGetSetCookie = upstream.headers as Headers & {
    getSetCookie?: () => string[];
  };

  if (typeof headersWithGetSetCookie.getSetCookie === 'function') {
    const cookies = headersWithGetSetCookie.getSetCookie();
    for (const cookie of cookies) {
      target.append('set-cookie', cookie);
    }
    return;
  }

  const single = upstream.headers.get('set-cookie');
  if (single) {
    target.append('set-cookie', single);
  }
}

function buildDownstreamHeaders(upstream: Response): Headers {
  const headers = new Headers();

  upstream.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie') return;
    headers.set(key, value);
  });

  appendSetCookieHeaders(headers, upstream);

  return headers;
}

async function proxy(
  request: NextRequest,
  context: { params: { path: string[] } }
): Promise<Response> {
  try {
    const { path } = context.params;
    const targetUrl = buildTargetUrl(path, request);

    const upstream = await fetch(targetUrl, {
      method: request.method,
      headers: buildUpstreamHeaders(request),
      body:
        request.method !== 'GET' && request.method !== 'HEAD'
          ? await request.arrayBuffer()
          : undefined,
      redirect: 'manual',
    });

    const headers = buildDownstreamHeaders(upstream);
    const body = await upstream.arrayBuffer();

    return new Response(body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers,
    });
  } catch {
    return Response.json({ error: 'Proxy failed' }, { status: 502 });
  }
}

export async function GET(req: NextRequest, ctx: any) {
  return proxy(req, ctx);
}
export async function POST(req: NextRequest, ctx: any) {
  return proxy(req, ctx);
}
export async function PUT(req: NextRequest, ctx: any) {
  return proxy(req, ctx);
}
export async function PATCH(req: NextRequest, ctx: any) {
  return proxy(req, ctx);
}
export async function DELETE(req: NextRequest, ctx: any) {
  return proxy(req, ctx);
}
