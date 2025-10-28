const EventEmitter = require('events');

/**
 * Thư viện tracking và thao tác HTTP requests/responses trong Puppeteer
 * @extends EventEmitter
 */
class TrackingHttp extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = {
            debug: false,
            timeout: 30000,
            captureBody: true,
            captureHeaders: true,
            maxBodySize: 10 * 1024 * 1024, // 10MB
            ...config
        };

        this.page = null;
        this.requests = new Map();
        this.responses = new Map();
        this.interceptHandlers = new Map();
        this.waitingRequests = new Map();
        this.isEnabled = false;
    }

    /**
     * Khởi tạo tracking cho page
     * @param {Page} page - Puppeteer page instance
     */
    async enable(page) {
        if (this.isEnabled) {
            throw new Error('TrackingHttp đã được enable');
        }

        this.page = page;
        this.isEnabled = true;

        // Enable request interception
        await page.setRequestInterception(true);

        // Tracking requests
        page.on('request', (request) => this._handleRequest(request));

        // Tracking responses
        page.on('response', (response) => this._handleResponse(response));

        // Tracking failed requests
        page.on('requestfailed', (request) => this._handleRequestFailed(request));

        this._log('TrackingHttp enabled');
    }

    /**
     * Tắt tracking
     */
    async disable() {
        if (!this.isEnabled) return;

        if (this.page) {
            await this.page.setRequestInterception(false);
            this.page.removeAllListeners('request');
            this.page.removeAllListeners('response');
            this.page.removeAllListeners('requestfailed');
        }

        this.clear();
        this.isEnabled = false;
        this._log('TrackingHttp disabled');
    }

    /**
     * Xóa tất cả dữ liệu đã track
     */
    clear() {
        this.requests.clear();
        this.responses.clear();
        this.waitingRequests.clear();
    }

    /**
     * Đăng ký handler để intercept và modify request
     * @param {string|RegExp|Function} matcher - URL pattern hoặc function để match
     * @param {Function} handler - Handler function (request, helpers) => {}
     */
    interceptRequest(matcher, handler) {
        const id = Date.now() + Math.random();
        this.interceptHandlers.set(id, { matcher, handler, type: 'request' });
        return () => this.interceptHandlers.delete(id);
    }

    /**
     * Đăng ký handler để intercept và modify response
     * @param {string|RegExp|Function} matcher - URL pattern hoặc function để match
     * @param {Function} handler - Handler function (response, helpers) => {}
     */
    interceptResponse(matcher, handler) {
        const id = Date.now() + Math.random();
        this.interceptHandlers.set(id, { matcher, handler, type: 'response' });
        return () => this.interceptHandlers.delete(id);
    }

    /**
     * Chờ một request cụ thể được gửi đi
     * @param {string|RegExp|Function} matcher - URL pattern
     * @param {Object} options - Timeout options
     * @returns {Promise<Object>} Request data
     */
    waitForRequest(matcher, options = {}) {
        return new Promise((resolve, reject) => {
            const timeout = options.timeout || this.config.timeout;
            const timeoutId = setTimeout(() => {
                this.waitingRequests.delete(id);
                reject(new Error(`Timeout waiting for request: ${matcher}`));
            }, timeout);

            const id = Date.now() + Math.random();
            this.waitingRequests.set(id, {
                matcher,
                resolve: (data) => {
                    clearTimeout(timeoutId);
                    this.waitingRequests.delete(id);
                    resolve(data);
                },
                reject
            });
        });
    }

    /**
     * Chờ một response cụ thể
     * @param {string|RegExp|Function} matcher - URL pattern
     * @param {Object} options - Timeout options
     * @returns {Promise<Object>} Response data
     */
    waitForResponse(matcher, options = {}) {
        return new Promise((resolve, reject) => {
            const timeout = options.timeout || this.config.timeout;
            const checkInterval = 100;
            const startTime = Date.now();

            const check = () => {
                const response = this.findResponse(matcher);
                if (response) {
                    resolve(response);
                    return;
                }

                if (Date.now() - startTime > timeout) {
                    reject(new Error(`Timeout waiting for response: ${matcher}`));
                    return;
                }

                setTimeout(check, checkInterval);
            };

            check();
        });
    }

    /**
     * Tìm request theo matcher
     * @param {string|RegExp|Function} matcher - URL pattern
     * @returns {Object|null} Request data
     */
    findRequest(matcher) {
        for (const [url, data] of this.requests.entries()) {
            if (this._matchUrl(url, matcher)) {
                return data;
            }
        }
        return null;
    }

    /**
     * Tìm tất cả requests khớp với matcher
     * @param {string|RegExp|Function} matcher - URL pattern
     * @returns {Array<Object>} Array of request data
     */
    findAllRequests(matcher) {
        const results = [];
        for (const [url, data] of this.requests.entries()) {
            if (this._matchUrl(url, matcher)) {
                results.push(data);
            }
        }
        return results;
    }

    /**
     * Tìm response theo matcher
     * @param {string|RegExp|Function} matcher - URL pattern
     * @returns {Object|null} Response data
     */
    findResponse(matcher) {
        for (const [url, data] of this.responses.entries()) {
            if (this._matchUrl(url, matcher)) {
                return data;
            }
        }
        return null;
    }

    /**
     * Tìm tất cả responses khớp với matcher
     * @param {string|RegExp|Function} matcher - URL pattern
     * @returns {Array<Object>} Array of response data
     */
    findAllResponses(matcher) {
        const results = [];
        for (const [url, data] of this.responses.entries()) {
            if (this._matchUrl(url, matcher)) {
                results.push(data);
            }
        }
        return results;
    }

    /**
     * Lấy tất cả requests
     * @returns {Array<Object>}
     */
    getAllRequests() {
        return Array.from(this.requests.values());
    }

    /**
     * Lấy tất cả responses
     * @returns {Array<Object>}
     */
    getAllResponses() {
        return Array.from(this.responses.values());
    }

    /**
     * Lọc requests theo điều kiện
     * @param {Function} predicate - Filter function
     * @returns {Array<Object>}
     */
    filterRequests(predicate) {
        return this.getAllRequests().filter(predicate);
    }

    /**
     * Lọc responses theo điều kiện
     * @param {Function} predicate - Filter function
     * @returns {Array<Object>}
     */
    filterResponses(predicate) {
        return this.getAllResponses().filter(predicate);
    }

    /**
     * Handle request event
     * @private
     */
    async _handleRequest(request) {
        const url = request.url();
        const method = request.method();

        // Lưu request data
        const requestData = {
            url,
            method,
            headers: this.config.captureHeaders ? request.headers() : null,
            postData: this.config.captureBody ? request.postData() : null,
            resourceType: request.resourceType(),
            timestamp: Date.now(),
            isNavigationRequest: request.isNavigationRequest(),
        };

        this.requests.set(url, requestData);

        // Emit event
        this.emit('request', requestData);

        // Check waiting requests
        this._checkWaitingRequests(url, requestData);

        // Check intercept handlers
        let shouldContinue = true;
        let overrides = {};

        for (const [id, { matcher, handler, type }] of this.interceptHandlers.entries()) {
            if (type !== 'request') continue;

            if (this._matchUrl(url, matcher)) {
                try {
                    const helpers = {
                        abort: (errorCode = 'failed') => {
                            shouldContinue = false;
                            return { abort: errorCode };
                        },
                        continue: (options = {}) => {
                            overrides = {...overrides, ...options };
                            return { continue: true };
                        },
                        respond: (response) => {
                            shouldContinue = false;
                            return { respond: response };
                        }
                    };

                    const result = await handler(requestData, helpers);

                    if (result && result.abort) {
                        await request.abort(result.abort);
                        this._log(`Request aborted: ${url}`);
                        return;
                    }

                    if (result && result.respond) {
                        await request.respond(result.respond);
                        this._log(`Request responded: ${url}`);
                        return;
                    }

                    if (result && result.continue) {
                        overrides = {...overrides, ...result.continue };
                    }
                } catch (error) {
                    this._log(`Error in request handler: ${error.message}`, 'error');
                }
            }
        }

        // Continue request với hoặc không có modifications
        try {
            if (shouldContinue) {
                await request.continue(overrides);
            }
        } catch (error) {
            this._log(`Error continuing request: ${error.message}`, 'error');
        }
    }

    /**
     * Handle response event
     * @private
     */
    async _handleResponse(response) {
        const url = response.url();
        const status = response.status();

        try {
            let body = null;

            if (this.config.captureBody) {
                const buffer = await response.buffer();
                if (buffer.length <= this.config.maxBodySize) {
                    const contentType = response.headers()['content-type'] || '';

                    if (contentType.includes('application/json')) {
                        try {
                            body = JSON.parse(buffer.toString('utf8'));
                        } catch (e) {
                            body = buffer.toString('utf8');
                        }
                    } else if (contentType.includes('text/')) {
                        body = buffer.toString('utf8');
                    } else {
                        body = buffer.toString('base64');
                    }
                }
            }

            const responseData = {
                url,
                status,
                statusText: response.statusText(),
                headers: this.config.captureHeaders ? response.headers() : null,
                body,
                ok: response.ok(),
                fromCache: response.fromCache(),
                fromServiceWorker: response.fromServiceWorker(),
                timestamp: Date.now(),
                request: this.requests.get(url),
            };

            this.responses.set(url, responseData);

            // Emit event
            this.emit('response', responseData);

            // Check intercept handlers
            for (const [id, { matcher, handler, type }] of this.interceptHandlers.entries()) {
                if (type !== 'response') continue;

                if (this._matchUrl(url, matcher)) {
                    try {
                        await handler(responseData, {
                            modifyBody: (newBody) => {
                                responseData.body = newBody;
                                this.responses.set(url, responseData);
                            }
                        });
                    } catch (error) {
                        this._log(`Error in response handler: ${error.message}`, 'error');
                    }
                }
            }
        } catch (error) {
            this._log(`Error handling response: ${error.message}`, 'error');
        }
    }

    /**
     * Handle failed request event
     * @private
     */
    _handleRequestFailed(request) {
        const url = request.url();
        const failure = request.failure();

        const failureData = {
            url,
            method: request.method(),
            errorText: failure ? failure.errorText : 'Unknown error',
            timestamp: Date.now(),
        };

        this.emit('requestfailed', failureData);
        this._log(`Request failed: ${url} - ${failureData.errorText}`, 'error');
    }

    /**
     * Check waiting requests
     * @private
     */
    _checkWaitingRequests(url, data) {
        for (const [id, waiter] of this.waitingRequests.entries()) {
            if (this._matchUrl(url, waiter.matcher)) {
                waiter.resolve(data);
            }
        }
    }

    /**
     * Match URL với pattern
     * @private
     */
    _matchUrl(url, matcher) {
        if (typeof matcher === 'string') {
            return url.includes(matcher);
        } else if (matcher instanceof RegExp) {
            return matcher.test(url);
        } else if (typeof matcher === 'function') {
            return matcher(url);
        }
        return false;
    }

    /**
     * Log helper
     * @private
     */
    _log(message, level = 'info') {
        if (this.config.debug) {
            const prefix = '[TrackingHttp]';
            if (level === 'error') {
                console.error(prefix, message);
            } else {
                console.log(prefix, message);
            }
        }
    }
}

module.exports = TrackingHttp;