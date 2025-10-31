const axios = require('axios');

class HttpClient {
    constructor(baseURL, options = {}) {
        this.client = axios.create({
            baseURL,
            timeout: options.timeout || 30000,
            headers: options.headers || {}
        });

        // Request interceptor
        this.client.interceptors.request.use(
            (config) => {
                if (options.onRequest) {
                    options.onRequest(config);
                }
                return config;
            },
            (error) => Promise.reject(error)
        );

        // Response interceptor
        this.client.interceptors.response.use(
            (response) => {
                if (options.onResponse) {
                    options.onResponse(response);
                }
                return response;
            },
            (error) => {
                if (options.onError) {
                    options.onError(error);
                }
                return Promise.reject(error);
            }
        );
    }

    async get(url, config = {}) {
        const response = await this.client.get(url, config);
        return response.data;
    }

    async post(url, data = null, config = {}) {
        const response = await this.client.post(url, data, config);
        return response.data;
    }

    async put(url, data = null, config = {}) {
        const response = await this.client.put(url, data, config);
        return response.data;
    }

    async delete(url, config = {}) {
        const response = await this.client.delete(url, config);
        return response.data;
    }

    async request(config) {
        const response = await this.client.request(config);
        return response.data;
    }
}

module.exports = HttpClient;