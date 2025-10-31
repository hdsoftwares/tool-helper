const EventEmitter = require('events');

class TrackingHttp extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = { timeout: 30000, debug: false, ...config };
        this.page = null;
        this.isEnabled = false;
    }

    async enable(page) {
        if (this.isEnabled) throw new Error('TrackingHttp đã được enable');
        this.page = page;
        this.isEnabled = true;
        if (this.config.debug) console.log('[TrackingHttp] enabled');
    }

    async disable() {
        if (!this.isEnabled) return;
        this.page = null;
        this.isEnabled = false;
        if (this.config.debug) console.log('[TrackingHttp] disabled');
    }

    // Wait for a specific response, then return { url, status, method, headers, body, timestamp }
    waitForResponse(matcher, options = {}) {
        if (!this.page) throw new Error('TrackingHttp chưa enable');
        const timeout = options.timeout || this.config.timeout;
        const methodFilter = options.method ? String(options.method).toUpperCase() : null;

        return this.page.waitForResponse((res) => {
            const url = res.url();
            if (typeof matcher === 'string' && !url.includes(matcher)) return false;
            if (matcher instanceof RegExp && !matcher.test(url)) return false;
            if (typeof matcher === 'function') {
                const r = matcher(url);
                if (typeof r === 'boolean' && !r) return false;
            }
            if (methodFilter && String(res.request().method()).toUpperCase() !== methodFilter) return false;
            return true;
        }, { timeout }).then(async(res) => {
            let body;
            try { body = await res.json(); } catch (_) { try { body = await res.text(); } catch (_) { body = null; } }
            const data = {
                url: res.url(),
                status: res.status(),
                method: res.request().method(),
                headers: typeof res.headers === 'function' ? res.headers() : {},
                body,
                timestamp: Date.now()
            };
            this.emit('response', data);
            return data;
        });
    }
}

module.exports = TrackingHttp;