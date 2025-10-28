/**
 * @hd-software/tool-helper
 * Complete automation toolkit for Chrome web automation
 * 
 * Features:
 * - XPath & CSS Selector Helper
 * - Telegram Bot Integration
 * - Worker Pool (Multi-threading)
 * - Browser Manager
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
module.exports = {
    // XPath & Selector Tools
    SelectorHelper,
    XPathBuilder,
    // Telegram Bot
    TelegramBot,
    // Organized by category
    xpath: {
        SelectorHelper,
        XPathBuilder
    },
    telegram: {
        Bot: TelegramBot,
        // Convenience function
        createBot: (token, options) => new TelegramBot(token, options)
    },
    version: '1.0.0',
    // Helper to get all available modules
    getModules: () => {
        return {
            xpath: ['SelectorHelper', 'XPathBuilder'],
            telegram: ['TelegramBot'],
            browser: [], // TODO
            threading: [], // TODO
            utils: [] // TODO
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