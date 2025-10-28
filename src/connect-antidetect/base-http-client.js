/**
 * Base HTTP Client
 * Base class for HTTP requests with common functionality
 * 
 * @author HD Software
 */

class BaseHttpClient {
    constructor(config) {
        this.baseUrl = config.baseUrl;
        this.apiKey = config.apiKey || '';
        this.timeout = config.timeout || 30000;
    }

    async request(method, endpoint, body = null) {
        try {
            const headers = {
                'Content-Type': 'application/json',
                'User-Agent': 'HDSoftware-Automation/1.0'
            };

            if (this.apiKey) {
                headers['Authorization'] = `Bearer ${this.apiKey}`;
            }

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.timeout);

            const options = {
                method,
                headers,
                signal: controller.signal
            };

            if (body) {
                options.body = JSON.stringify(body);
            }

            const response = await fetch(`${this.baseUrl}${endpoint}`, options);
            clearTimeout(timeoutId);

            const responseText = await response.text();

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${responseText}`);
            }

            return responseText;
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error(`Request timeout after ${this.timeout}ms`);
            }
            throw new Error(`Request failed: ${error.message}`);
        }
    }

    async get(endpoint) {
        return this.request('GET', endpoint);
    }

    async post(endpoint, body = null) {
        return this.request('POST', endpoint, body);
    }

    async delete(endpoint) {
        return this.request('DELETE', endpoint);
    }
}

module.exports = BaseHttpClient;