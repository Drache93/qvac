import { createServer } from 'http';
import { URL } from 'url';
import { OAUTH_CALLBACK_PATH, OAUTH_WAIT_FOR_CODE_TIMEOUT_MS } from './keys.js';
import { CoreError } from '../errors.js';
export function waitForOAuthCallback(opts) {
    const { port, state, timeoutMs = OAUTH_WAIT_FOR_CODE_TIMEOUT_MS, onListening } = opts;
    return new Promise((resolve, reject) => {
        let settled = false;
        const respond = (res, status, { body = '', close = false } = {}) => {
            const headers = { 'Content-Type': 'text/html; charset=utf-8' };
            if (close) {
                headers.Connection = 'close';
            }
            res.writeHead(status, headers);
            res.end(body);
        };
        const settle = (outcome, res) => {
            if (settled)
                return;
            settled = true;
            clearTimeout(timer);
            const close = () => {
                server.close();
                server.closeAllConnections?.();
            };
            const socket = res?.socket;
            if (socket) {
                socket.once('close', close);
            }
            else {
                close();
            }
            if ('error' in outcome) {
                reject(outcome.error);
            }
            else {
                resolve(outcome);
            }
        };
        const server = createServer((req, res) => {
            const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`);
            if (url.pathname !== OAUTH_CALLBACK_PATH) {
                return respond(res, 404, { body: 'Not found' });
            }
            if (url.searchParams.get('state') !== state) {
                return respond(res, 204);
            }
            const error = url.searchParams.get('error');
            const code = url.searchParams.get('code');
            if (error) {
                respond(res, 200, {
                    body: '<html><body><p>Authorization failed. You can close this tab.</p></body></html>',
                    close: true
                });
                settle({ error: new CoreError('OAUTH_PROVIDER_ERROR', [error]) }, res);
            }
            else if (code) {
                respond(res, 200, {
                    body: '<html><body><p>You can close this tab.</p></body></html>',
                    close: true
                });
                settle({ code }, res);
            }
            else {
                respond(res, 204);
            }
        });
        const timer = setTimeout(() => settle({ error: new CoreError('OAUTH_CALLBACK_TIMEOUT') }), timeoutMs);
        server.once('error', (err) => settle({ error: err }));
        server.listen(port, '127.0.0.1', () => onListening?.());
    });
}
