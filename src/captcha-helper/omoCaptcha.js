const HttpClient = require("../utils/httpClient");

class OmoCaptchaProvider {
    constructor(apiKey, options = {}) {
        this.apiKey = apiKey;
        this.baseURL = 'https://api.omocaptcha.com/v2';
        this.timeout = options.timeout || 30000;
        this.pollingInterval = options.pollingInterval || 3000;

        this.http = new HttpClient(this.baseURL, {
            timeout: this.timeout,
            onRequest: (config) => {
                if (options.debug) {
                    console.log('[OmoCaptcha] Request:', config.method, config.url);
                }
            },
            onError: (error) => {
                if (options.debug) {
                    console.error('[OmoCaptcha] Error:', error.message);
                }
            }
        });
    }

    /**
     * Giải ImageToText captcha
     * @param {string} imageBase64 - Ảnh base64
     * @param {Object} options - { module: 'module_1' }
     */
    async imageToText(imageBase64, options = {}) {
        try {
            const taskId = await this.createTask({
                type: 'ImageToTextTask',
                imageBase64,
                ...options
            });
            const result = await this.waitForResult(taskId);
            return { success: true, text: result.solution.text };
        } catch (err) {
            return { success: false, error: err && err.message ? err.message : String(err) };
        }
    }

    /**
     * Giải Tiktok3DSelectObjectWebTask
     * @param {string} imageBase64 - Ảnh base64
     * @param {number} widthView - Chiều rộng ảnh hiển thị trên web
     * @param {number} heightView - Chiều cao ảnh hiển thị trên web
     * @param {Object} options - Tùy chọn thêm (nếu có)
     * @returns {Promise<{success:boolean, pointA?:{x:number,y:number}, pointB?:{x:number,y:number}, solution?:any, error?:string}>}
     */
    async tiktok3DSelectObjectWeb(imageBase64, widthView, heightView, options = {}) {
        try {
            const taskId = await this.createTask({
                type: 'Tiktok3DSelectObjectWebTask',
                imageBase64,
                widthView,
                heightView,
                ...options
            });

            const result = await this.waitForResult(taskId);
            const solution = result.solution || {};
            return {
                success: true,
                pointA: solution.pointA,
                pointB: solution.pointB
            };
        } catch (err) {
            return { success: false, error: err && err.message ? err.message : String(err) };
        }
    }

    // ========== Internal Methods ==========
    async createTask(taskData) {
        const response = await this.http.post('/createTask', {
            clientKey: this.apiKey,
            task: taskData
        });
        console.log(response, 'response')
        if (response.errorId !== 0) {
            throw new Error(response.errorDescription || 'Create task failed');
        }

        return response.taskId;
    }

    async getTaskResult(taskId) {
        const response = await this.http.post('/getTaskResult', {
            clientKey: this.apiKey,
            taskId
        });
        return response;
    }

    async waitForResult(taskId) {
        const startTime = Date.now();

        while (true) {
            if (Date.now() - startTime > this.timeout) {
                throw new Error('Captcha solving timeout');
            }

            const result = await this.getTaskResult(taskId);

            if (result.errorId !== 0) {
                throw new Error(result.errorDescription || 'Task failed');
            }

            if (result.status === 'ready') {
                return result;
            }

            await new Promise(resolve => setTimeout(resolve, this.pollingInterval));
        }
    }
}

module.exports = OmoCaptchaProvider;