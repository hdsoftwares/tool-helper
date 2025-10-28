/**
 * @hd-software/tool-helper
 * Helper utilities for automation, XPath selection, network tracking, and Telegram integration
 */

// XPath Helper
const { SelectorHelper, XPathBuilder } = require('./src/xpath/xpath-helper');

// Export all modules
module.exports = {
    // XPath Helper
    SelectorHelper,
    XPathBuilder,

    // Re-export for convenience
    xpath: {
        SelectorHelper,
        XPathBuilder
    }
};