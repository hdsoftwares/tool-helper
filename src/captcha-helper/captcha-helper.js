const OmoCaptchaProvider = require("./omoCaptcha");

class CaptchaHelper {
    constructor() {
        this.providers = {
            omocaptcha: OmoCaptchaProvider,
        };
    }

    /**
     * Connect với provider
     * @param {string} providerName - 'omocaptcha'
     * @param {string} apiKey
     * @param {Object} options - { timeout, pollingInterval }
     */
    connect(providerName, apiKey, options = {}) {
        const Provider = this.providers[providerName.toLowerCase()];

        if (!Provider) {
            throw new Error(`Provider '${providerName}' not supported. Available: ${Object.keys(this.providers).join(', ')}`);
        }

        return new Provider(apiKey, options);
    }

    /**
     * Đăng ký provider tùy chỉnh
     */
    register(name, ProviderClass) {
        this.providers[name.toLowerCase()] = ProviderClass;
    }

    /**
     * Danh sách providers có sẵn
     */
    getAvailableProviders() {
        return Object.keys(this.providers);
    }
}
module.exports = CaptchaHelper;