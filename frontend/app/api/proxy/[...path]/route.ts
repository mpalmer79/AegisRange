import { NextRequest } from 'next/server';

function getBackendUrl(): string {
  const url = process.env.BACKEND_URL;

  if (!url) {
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

function copyRequestHeaders(request: NextRequest): Headers {
  const headers = new Headers(request.headers);

  headers.delete('host');
  headers.delete('connection');
  headers.delete('content-length');

  return headers;
}

async function proxy(request: NextRequest, context: { params: { path: string[] } }) {
  const targetUrl = buildTargetUrl(context.params.path, request);
  const headers = copyRequestHeaders(request);

  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: 'manual',
  };

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = await request.arrayBuffer();
  }

  const upstream = await fetch(targetUrl, init);

  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.delete('content-length');
  responseHeaders.delete('content-encoding');
  responseHeaders.delete('transfer-encoding');

  const body = await upstream.arrayBuffer();

  return new Response(body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

export async function GET(request: NextRequest, context: { params: { path: string[] } }) {
  return proxy(request, context);
}

export async function POST(request: NextRequest, context: { params: { path: string[] } }) {
  return proxy(request, context);
}

export async function PUT(request: NextRequest, context: { params: { path: string[] } }) {
  return proxy(request, context);
}

export async function PATCH(request: NextRequest, context: { params: { path: string[] } }) {
  return proxy(request, context);
}

export async function DELETE(request: NextRequest, context: { params: { path: string[] } }) {
  return proxy(request, context);
}

export async function OPTIONS(request: NextRequest, context: { params: { path: string[] } }) {
  return proxy(request, context);
}

export async function HEAD(request: NextRequest, context: { params: { path: string[] } }) {
  return proxy(request, context);
}