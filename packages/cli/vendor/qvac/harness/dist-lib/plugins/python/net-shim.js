export function pythonReachesNetwork() {
    const wasm = WebAssembly;
    return (typeof globalThis.Bare !== 'undefined' &&
        'Suspending' in wasm &&
        typeof wasm.Suspending === 'function');
}
export const NET_SHIM = `
def _qvac_install_net():
    import errno, http.client, io
    import js
    from pyodide.ffi import can_run_sync, run_sync, to_js

    if getattr(http.client, '_qvac_net', False):
        return

    class _Response(http.client.HTTPResponse):
        # the body is read in full by the fetch, so there is no socket behind it
        def __init__(self, status, headers, body, url):
            self.status = self.code = status
            self.reason = http.client.responses.get(status, '')
            self.headers = self.msg = http.client.HTTPMessage()
            for name, value in headers:
                self.headers[name] = value
            self.fp = io.BytesIO(body)
            self.version = 11
            self.will_close = True
            self.chunked = False
            self.length = len(body)
            self.url = url
            self.debuglevel = 0

        def read(self, amt=None):
            return self.fp.read() if amt is None or amt < 0 else self.fp.read(amt)

        def read1(self, n=-1):
            return self.read(n)

        def readinto(self, b):
            data = self.fp.read(len(b))
            b[: len(data)] = data
            return len(data)

        def peek(self, n=0):
            pos = self.fp.tell()
            data = self.fp.read(max(n, 1))
            self.fp.seek(pos)
            return data

        def isclosed(self):
            return self.fp.closed

        def close(self):
            self.fp.close()

        def fileno(self):
            raise OSError('this response has no socket')

    class _Connection(http.client.HTTPConnection):
        scheme = 'http'

        def __init__(self, host, port=None, timeout=None, source_address=None, blocksize=8192, **kw):
            self.host, self.port, self.timeout = host, port, timeout
            self.sock = None
            self.debuglevel = 0
            self._tunnel_host = None
            self._request = None
            self._response = None

        def set_debuglevel(self, level):
            pass

        def set_tunnel(self, host, port=None, headers=None):
            self._tunnel_host = host

        def connect(self):
            pass

        def close(self):
            pass

        def putrequest(self, method, url, skip_host=False, skip_accept_encoding=False):
            self._request = [method, url, {}, b'']
            self._response = None

        def putheader(self, header, *values):
            self._request[2][header] = ', '.join(str(v) for v in values)

        # A socket connects while the request is sent, so that is where a failure lands and
        # where urllib turns it into URLError. A body sent after the headers waits for it.
        def endheaders(self, message_body=None, *, encode_chunked=False):
            if message_body is not None:
                self.send(message_body)
            if message_body is not None or self._request[0] in ('GET', 'HEAD', 'DELETE', 'OPTIONS'):
                self._response = self._fetch()

        def send(self, data):
            if hasattr(data, 'read'):
                data = data.read()
            if isinstance(data, str):
                data = data.encode()
            self._request[3] += bytes(data)

        def request(self, method, url, body=None, headers={}, *, encode_chunked=False):
            self.putrequest(method, url)
            for name, value in dict(headers).items():
                self.putheader(name, value)
            self.endheaders(body)

        def getresponse(self):
            response = self._response or self._fetch()
            self._response = None
            return response

        def _fetch(self):
            method, url, headers, body = self._request
            if not url.startswith(('http://', 'https://')):
                port = '' if self.port in (None, self.default_port) else ':%d' % self.port
                url = '%s://%s%s%s' % (self.scheme, self.host, port, url)
            if not can_run_sync():
                raise OSError(errno.EHOSTUNREACH, 'Host is unreachable')
            # the fetch hands back decoded bytes, so no encoding is asked for and none reported
            skip = ('accept-encoding', 'connection', 'host', 'content-length')
            headers = {k: v for k, v in headers.items() if k.lower() not in skip}
            headers['Accept-Encoding'] = 'identity'
            init = {'method': method, 'headers': headers, 'redirect': 'manual'}
            if body:
                init['body'] = to_js(body)
            try:
                response = run_sync(js.fetch(url, to_js(init, dict_converter=js.Object.fromEntries)))
                data = bytes(run_sync(response.arrayBuffer()).to_py())
            except Exception as error:
                # the guard's own refusal, or the transport's: either says more than an errno
                raise OSError(getattr(error, 'message', None) or str(error)) from None
            entries = [(str(k), str(v)) for k, v in response.headers.entries()]
            drop = ('content-encoding', 'transfer-encoding', 'content-length')
            kept = [(k, v) for k, v in entries if k.lower() not in drop]
            kept.append(('Content-Length', str(len(data))))
            return _Response(int(response.status), kept, data, url)

    class _HTTPSConnection(_Connection):
        scheme = 'https'
        default_port = 443

    http.client.HTTPConnection = _Connection
    http.client.HTTPSConnection = _HTTPSConnection
    http.client._qvac_net = True

_qvac_install_net()
del _qvac_install_net
`;
