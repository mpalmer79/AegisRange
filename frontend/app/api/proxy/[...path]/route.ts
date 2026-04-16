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
    const lower = key.toLowerCase();

    if (lower === 'set-cookie') return;

    headers.set(key, value);
  });

  appendSetCookieHeaders(headers, upstream);
  return headers;
}
