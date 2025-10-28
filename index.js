/**
 * @hd-software/tool-helper
 * Complete automation toolkit for Chrome web automation
 * 
 * Features:
 * - XPath & CSS Selector Helper
 * - Telegram Bot Integration
 * - Antidetect Browser Manager (XLogin, GPM, GoLogin)
 * - Worker Pool (Multi-threading)
 * - Action Executor
 * - Wait & Retry Helpers
 * 
 * @version 1.0.0
 * @author HD Software
 */

// ==================== CORE MODULES ====================

// XPath & Selector
const { SelectorHelper, XPathBuilder } = require('./src/xpath/xpath-helper');

// Telegram
const TelegramBot = require('./src/telegram/telegram-bot');

// Antidetect Browser Manager
const {
    ConnectAntidetectHelper,
    PlatformType
} = require('./src/connect-antidetect/connect-antidetect-helper');

// ==================== MAIN EXPORTS ====================

module.exports = {
    // XPath & Selector Tools
    SelectorHelper,
    XPathBuilder,

    // Telegram Bot
    TelegramBot,

    // Antidetect Browser Helper
    ConnectAntidetectHelper,
    PlatformType,

    // ==================== ORGANIZED BY CATEGORY ====================

    xpath: {
        SelectorHelper,
        XPathBuilder
    },

    telegram: {
        Bot: TelegramBot,
        // Convenience function
        createBot: (token, options) => new TelegramBot(token, options)
    },

    antidetect: {
        Helper: ConnectAntidetectHelper,
        PlatformType,
        // Convenience functions
        createHelper: (config) => new ConnectAntidetectHelper(config),
        getSupportedPlatforms: () => ConnectAntidetectHelper.getSupportedPlatforms(),
        isPlatformSupported: (type) => ConnectAntidetectHelper.isPlatformSupported(type)
    },

    // ==================== METADATA ====================

    version: '1.0.0',

    // Helper to get all available modules
    getModules: () => {
        return {
            xpath: ['SelectorHelper', 'XPathBuilder'],
            telegram: ['TelegramBot'],
            antidetect: ['ConnectAntidetectHelper', 'PlatformType'],
            browser: [], // TODO
            threading: [], // TODO
            utils: [] // TODO
        };
    },

    // Get package info
    getInfo: () => {
        return {
            name: '@hd-software/tool-helper',
            version: '1.0.0',
            description: 'Complete automation toolkit for Chrome web automation',
            features: [
                'XPath & CSS Selector Helper',
                'Telegram Bot Integration',
                'Antidetect Browser Manager (XLogin, GPM, GoLogin)',
                'Worker Pool (Multi-threading)',
                'Action Executor',
                'Wait & Retry Helpers'
            ],
            author: 'HD Software',
            license: 'PRIVATE'
        };
    }
};

// ==================== CONVENIENCE EXPORTS ====================

// Allow direct destructuring
module.exports.default = module.exports;

// CommonJS compatibility
if (typeof exports !== 'undefined') {
    Object.assign(exports, module.exports);
}