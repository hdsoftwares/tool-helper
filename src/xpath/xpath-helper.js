/**
 * XPath & Selector Helper - Modern Element Finder & Interaction Module
 * Supports: XPath, CSS Selector, Text, Attributes
 * Compatible with: Puppeteer, Playwright
 */

class SelectorHelper {
    constructor(page, options = {}) {
        this.page = page;
        this.config = {
            defaultTimeout: options.defaultTimeout || 30000,
            retryAttempts: options.retryAttempts || 3,
            retryDelay: options.retryDelay || 1000,
            scrollIntoView: options.scrollIntoView !== false,
            waitForStable: options.waitForStable !== false,
            highlightElement: options.highlightElement || false,
            screenshotOnError: options.screenshotOnError || false,
            ...options
        };

        this.lastError = null;
    }

    // ==================== CORE FINDER METHODS ====================

    /**
     * Universal element finder - tự động detect selector type
     * @param {string} selector - XPath, CSS, hoặc text
     * @param {object} options - Tuỳ chọn
     * @returns {ElementHandle|null}
     */
    async find(selector, options = {}) {
        const opts = {...this.config, ...options };
        const selectorType = this._detectSelectorType(selector);

        try {
            let element;

            switch (selectorType) {
                case 'xpath':
                    element = await this._findByXPath(selector, opts);
                    break;
                case 'css':
                    element = await this._findByCSS(selector, opts);
                    break;
                case 'text':
                    element = await this._findByText(selector, opts);
                    break;
                default:
                    throw new Error(`Unknown selector type: ${selectorType}`);
            }

            if (element && opts.highlightElement) {
                await this._highlightElement(element);
            }

            return element;
        } catch (error) {
            await this._handleError(error, selector, opts);
            return null;
        }
    }

    /**
     * Tìm tất cả elements matching selector
     */
    async findAll(selector, options = {}) {
        const opts = {...this.config, ...options };
        const selectorType = this._detectSelectorType(selector);

        try {
            switch (selectorType) {
                case 'xpath':
                    return await this._findAllByXPath(selector, opts);
                case 'css':
                    return await this._findAllByCSS(selector, opts);
                case 'text':
                    return await this._findAllByText(selector, opts);
                default:
                    return [];
            }
        } catch (error) {
            await this._handleError(error, selector, opts);
            return [];
        }
    }

    /**
     * Chờ element xuất hiện
     */
    async waitFor(selector, options = {}) {
        const opts = {...this.config, ...options };
        const timeout = opts.timeout || opts.defaultTimeout;
        const selectorType = this._detectSelectorType(selector);

        const startTime = Date.now();

        while (Date.now() - startTime < timeout) {
            const element = await this.find(selector, {...opts, timeout: 0 });

            if (element) {
                // Wait for element to be stable (không move)
                if (opts.waitForStable) {
                    await this._waitForStable(element, 500);
                }
                return element;
            }

            await this._sleep(opts.retryDelay);
        }

        throw new Error(`Timeout waiting for selector: ${selector} (${timeout}ms)`);
    }

    /**
     * Chờ element biến mất
     */
    async waitForDisappear(selector, options = {}) {
        const opts = {...this.config, ...options };
        const timeout = opts.timeout || opts.defaultTimeout;
        const startTime = Date.now();

        while (Date.now() - startTime < timeout) {
            const element = await this.find(selector, {...opts, timeout: 0 });

            if (!element) {
                return true;
            }

            await this._sleep(opts.retryDelay);
        }

        throw new Error(`Element still visible after timeout: ${selector}`);
    }

    // ==================== INTERACTION METHODS ====================

    /**
     * Click element
     */
    async click(selector, options = {}) {
        const opts = {...this.config, ...options };
        const element = await this.waitFor(selector, opts);

        if (!element) {
            throw new Error(`Cannot find element to click: ${selector}`);
        }

        // Scroll into view if needed
        if (opts.scrollIntoView) {
            await this._scrollIntoView(element);
        }

        // Wait for clickable
        await this._waitForClickable(element);

        // Click with retry
        await this._withRetry(async() => {
            await element.click(opts.clickOptions || {});
        }, opts.retryAttempts);

        return true;
    }

    /**
     * Double click
     */
    async doubleClick(selector, options = {}) {
        const element = await this.waitFor(selector, options);

        if (options.scrollIntoView) {
            await this._scrollIntoView(element);
        }

        await element.click({ clickCount: 2 });
        return true;
    }

    /**
     * Right click (context menu)
     */
    async rightClick(selector, options = {}) {
        const element = await this.waitFor(selector, options);

        if (options.scrollIntoView) {
            await this._scrollIntoView(element);
        }

        await element.click({ button: 'right' });
        return true;
    }

    /**
     * Hover over element
     */
    async hover(selector, options = {}) {
        const element = await this.waitFor(selector, options);

        if (options.scrollIntoView) {
            await this._scrollIntoView(element);
        }

        await element.hover();
        return true;
    }

    /**
     * Type text vào input
     */
    async type(selector, text, options = {}) {
        const opts = {
            clear: true,
            delay: 50,
            ...this.config,
            ...options
        };

        const element = await this.waitFor(selector, opts);

        if (opts.scrollIntoView) {
            await this._scrollIntoView(element);
        }

        // Clear existing text
        if (opts.clear) {
            await this.clear(selector, { timeout: 0 });
        }

        // Type with human-like delay
        await element.type(text, { delay: opts.delay });

        // Optional: trigger change event
        if (opts.triggerChange) {
            await element.evaluate(el => {
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            });
        }

        return true;
    }

    /**
     * Clear input field
     */
    async clear(selector, options = {}) {
        const element = await this.waitFor(selector, options);

        await element.click({ clickCount: 3 }); // Select all
        await this.page.keyboard.press('Backspace');

        return true;
    }

    /**
     * Set value directly (nhanh hơn type)
     */
    async setValue(selector, value, options = {}) {
        const element = await this.waitFor(selector, options);

        await element.evaluate((el, val) => {
            if (el.tagName === 'SELECT') {
                el.value = val;
                el.dispatchEvent(new Event('change', { bubbles: true }));
            } else {
                el.value = val;
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }, value);

        return true;
    }

    /**
     * Select option from dropdown
     */
    async select(selector, value, options = {}) {
        const element = await this.waitFor(selector, options);

        await element.evaluate((el, val) => {
            const option = Array.from(el.options).find(opt =>
                opt.value === val || opt.text === val
            );

            if (option) {
                el.value = option.value;
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }, value);

        return true;
    }

    /**
     * Check/uncheck checkbox or radio
     */
    async check(selector, checked = true, options = {}) {
        const element = await this.waitFor(selector, options);

        const isChecked = await element.evaluate(el => el.checked);

        if (isChecked !== checked) {
            await element.click();
        }

        return true;
    }

    /**
     * Upload file
     */
    async uploadFile(selector, filePath, options = {}) {
        const element = await this.waitFor(selector, options);
        await element.uploadFile(filePath);
        return true;
    }

    // ==================== DATA EXTRACTION METHODS ====================

    /**
     * Get text content
     */
    async getText(selector, options = {}) {
        const element = await this.find(selector, options);

        if (!element) return null;

        return await element.evaluate(el => {
            return el.innerText || el.textContent;
        });
    }

    /**
     * Get trimmed text
     */
    async getTextTrimmed(selector, options = {}) {
        const text = await this.getText(selector, options);
        return text ? text.trim() : null;
    }

    /**
     * Get attribute value
     */
    async getAttribute(selector, attribute, options = {}) {
        const element = await this.find(selector, options);

        if (!element) return null;

        return await element.evaluate((el, attr) => {
            return el.getAttribute(attr);
        }, attribute);
    }

    /**
     * Get property value (như value, checked, disabled)
     */
    async getProperty(selector, property, options = {}) {
        const element = await this.find(selector, options);

        if (!element) return null;

        return await element.evaluate((el, prop) => {
            return el[prop];
        }, property);
    }

    /**
     * Get value from input
     */
    async getValue(selector, options = {}) {
        return await this.getProperty(selector, 'value', options);
    }

    /**
     * Get HTML content
     */
    async getHTML(selector, options = {}) {
        const element = await this.find(selector, options);

        if (!element) return null;

        return await element.evaluate(el => el.innerHTML);
    }

    /**
     * Get outer HTML
     */
    async getOuterHTML(selector, options = {}) {
        const element = await this.find(selector, options);

        if (!element) return null;

        return await element.evaluate(el => el.outerHTML);
    }

    /**
     * Get computed style
     */
    async getStyle(selector, property, options = {}) {
        const element = await this.find(selector, options);

        if (!element) return null;

        return await element.evaluate((el, prop) => {
            return window.getComputedStyle(el)[prop];
        }, property);
    }

    /**
     * Get bounding box (vị trí & kích thước)
     */
    async getBoundingBox(selector, options = {}) {
        const element = await this.find(selector, options);

        if (!element) return null;

        return await element.boundingBox();
    }

    /**
     * Extract data từ nhiều elements
     */
    async extractList(selector, fields, options = {}) {
        const elements = await this.findAll(selector, options);

        const results = [];

        for (const element of elements) {
            const item = {};

            for (const [key, fieldSelector] of Object.entries(fields)) {
                if (fieldSelector.startsWith('@')) {
                    // Attribute
                    const attr = fieldSelector.substring(1);
                    item[key] = await element.evaluate((el, a) => el.getAttribute(a), attr);
                } else if (fieldSelector === 'text()') {
                    // Text
                    item[key] = await element.evaluate(el => el.textContent.trim());
                } else if (fieldSelector.startsWith('.')) {
                    // Relative selector
                    const subElement = await element.$(fieldSelector);
                    if (subElement) {
                        item[key] = await subElement.evaluate(el => el.textContent.trim());
                    }
                } else {
                    item[key] = await element.evaluate((el, sel) => {
                        const sub = el.querySelector(sel);
                        return sub ? sub.textContent.trim() : null;
                    }, fieldSelector);
                }
            }

            results.push(item);
        }

        return results;
    }

    /**
     * Extract table data
     */
    async extractTable(selector, options = {}) {
        const tableElement = await this.find(selector, options);

        if (!tableElement) return null;

        return await tableElement.evaluate(table => {
            const headers = Array.from(table.querySelectorAll('thead th, thead td')).map(th =>
                th.textContent.trim()
            );

            const rows = Array.from(table.querySelectorAll('tbody tr')).map(tr => {
                const cells = Array.from(tr.querySelectorAll('td, th')).map(td =>
                    td.textContent.trim()
                );

                if (headers.length > 0) {
                    const rowData = {};
                    headers.forEach((header, i) => {
                        rowData[header] = cells[i] || '';
                    });
                    return rowData;
                }

                return cells;
            });

            return {
                headers,
                rows
            };
        });
    }

    // ==================== VALIDATION & CHECKING METHODS ====================

    /**
     * Check if element exists
     */
    async exists(selector, options = {}) {
        try {
            const element = await this.find(selector, {...options, timeout: 1000 });
            return element !== null;
        } catch {
            return false;
        }
    }

    /**
     * Check if element is visible
     */
    async isVisible(selector, options = {}) {
        const element = await this.find(selector, options);

        if (!element) return false;

        return await element.evaluate(el => {
            const style = window.getComputedStyle(el);
            return style.display !== 'none' &&
                style.visibility !== 'hidden' &&
                style.opacity !== '0' &&
                el.offsetWidth > 0 &&
                el.offsetHeight > 0;
        });
    }

    /**
     * Check if element is enabled
     */
    async isEnabled(selector, options = {}) {
        const element = await this.find(selector, options);

        if (!element) return false;

        return await element.evaluate(el => !el.disabled);
    }

    /**
     * Check if checkbox/radio is checked
     */
    async isChecked(selector, options = {}) {
        return await this.getProperty(selector, 'checked', options);
    }

    /**
     * Check if element has class
     */
    async hasClass(selector, className, options = {}) {
        const element = await this.find(selector, options);

        if (!element) return false;

        return await element.evaluate((el, cls) => {
            return el.classList.contains(cls);
        }, className);
    }

    /**
     * Count elements
     */
    async count(selector, options = {}) {
        const elements = await this.findAll(selector, options);
        return elements.length;
    }

    // ==================== ADVANCED INTERACTION METHODS ====================

    /**
     * Scroll to element
     */
    async scrollTo(selector, options = {}) {
        const element = await this.find(selector, options);

        if (!element) {
            throw new Error(`Cannot find element to scroll to: ${selector}`);
        }

        await this._scrollIntoView(element, options.scrollOptions);
        return true;
    }

    /**
     * Drag and drop
     */
    async dragAndDrop(sourceSelector, targetSelector, options = {}) {
        const source = await this.waitFor(sourceSelector, options);
        const target = await this.waitFor(targetSelector, options);

        const sourceBox = await source.boundingBox();
        const targetBox = await target.boundingBox();

        await this.page.mouse.move(
            sourceBox.x + sourceBox.width / 2,
            sourceBox.y + sourceBox.height / 2
        );
        await this.page.mouse.down();

        await this.page.mouse.move(
            targetBox.x + targetBox.width / 2,
            targetBox.y + targetBox.height / 2, { steps: 10 }
        );

        await this.page.mouse.up();
        return true;
    }

    /**
     * Take screenshot of element
     */
    async screenshot(selector, options = {}) {
        const element = await this.find(selector, options);

        if (!element) {
            throw new Error(`Cannot find element to screenshot: ${selector}`);
        }

        return await element.screenshot(options.screenshotOptions || {});
    }

    /**
     * Focus element
     */
    async focus(selector, options = {}) {
        const element = await this.find(selector, options);

        if (!element) {
            throw new Error(`Cannot find element to focus: ${selector}`);
        }

        await element.focus();
        return true;
    }

    /**
     * Execute custom function on element
     */
    async evaluate(selector, fn, ...args) {
        const element = await this.find(selector);

        if (!element) {
            throw new Error(`Cannot find element: ${selector}`);
        }

        return await element.evaluate(fn, ...args);
    }

    // ==================== PRIVATE HELPER METHODS ====================

    /**
     * Detect selector type
     */
    _detectSelectorType(selector) {
        if (selector.startsWith('//') || selector.startsWith('(//')) {
            return 'xpath';
        }

        if (selector.startsWith('text=') || selector.startsWith('text:')) {
            return 'text';
        }

        return 'css';
    }

    /**
     * Find by XPath
     */
    async _findByXPath(xpath, options) {
        const timeout = options.timeout || this.config.defaultTimeout;

        try {
            // Puppeteer style
            if (this.page.$x) {
                const elements = await this.page.$x(xpath);
                return elements[0] || null;
            }

            // Playwright style
            const element = await this.page.waitForSelector(`xpath=${xpath}`, {
                timeout,
                state: 'attached'
            });

            return element;
        } catch (error) {
            if (error.message.includes('timeout') || error.message.includes('Timeout')) {
                return null;
            }
            throw error;
        }
    }

    /**
     * Find all by XPath
     */
    async _findAllByXPath(xpath, options) {
        try {
            // Puppeteer
            if (this.page.$x) {
                return await this.page.$x(xpath);
            }

            // Playwright
            return await this.page.$$(`xpath=${xpath}`);
        } catch {
            return [];
        }
    }

    /**
     * Find by CSS
     */
    async _findByCSS(css, options) {
        const timeout = options.timeout || this.config.defaultTimeout;

        try {
            return await this.page.waitForSelector(css, {
                timeout,
                visible: options.visible !== false
            });
        } catch (error) {
            if (error.message.includes('timeout') || error.message.includes('Timeout')) {
                return null;
            }
            throw error;
        }
    }

    /**
     * Find all by CSS
     */
    async _findAllByCSS(css, options) {
        try {
            return await this.page.$$(css);
        } catch {
            return [];
        }
    }

    /**
     * Find by text content
     */
    async _findByText(textSelector, options) {
        const text = textSelector.replace(/^(text=|text:)/, '');
        const xpath = `//*[contains(text(), '${text}')]`;
        return await this._findByXPath(xpath, options);
    }

    /**
     * Find all by text
     */
    async _findAllByText(textSelector, options) {
        const text = textSelector.replace(/^(text=|text:)/, '');
        const xpath = `//*[contains(text(), '${text}')]`;
        return await this._findAllByXPath(xpath, options);
    }

    /**
     * Scroll element into view
     */
    async _scrollIntoView(element, options = {}) {
        await element.evaluate((el, opts) => {
            el.scrollIntoView({
                behavior: opts.behavior || 'smooth',
                block: opts.block || 'center',
                inline: opts.inline || 'center'
            });
        }, options);

        await this._sleep(300); // Wait for scroll animation
    }

    /**
     * Wait for element to be clickable
     */
    async _waitForClickable(element, timeout = 5000) {
        const startTime = Date.now();

        while (Date.now() - startTime < timeout) {
            const isClickable = await element.evaluate(el => {
                const rect = el.getBoundingClientRect();
                const style = window.getComputedStyle(el);

                return rect.width > 0 &&
                    rect.height > 0 &&
                    style.visibility !== 'hidden' &&
                    style.display !== 'none' &&
                    !el.disabled;
            });

            if (isClickable) return true;

            await this._sleep(100);
        }

        throw new Error('Element is not clickable');
    }

    /**
     * Wait for element position to be stable
     */
    async _waitForStable(element, duration = 500) {
        let lastBox = await element.boundingBox();
        const startTime = Date.now();

        while (Date.now() - startTime < duration) {
            await this._sleep(50);
            const currentBox = await element.boundingBox();

            if (!currentBox || !lastBox) break;

            if (currentBox.x !== lastBox.x || currentBox.y !== lastBox.y) {
                lastBox = currentBox;
                continue;
            }

            return true;
        }
    }

    /**
     * Highlight element (for debugging)
     */
    async _highlightElement(element) {
        await element.evaluate(el => {
            const original = el.style.outline;
            el.style.outline = '3px solid red';

            setTimeout(() => {
                el.style.outline = original;
            }, 2000);
        });
    }

    /**
     * Retry logic
     */
    async _withRetry(fn, maxAttempts = 3, delay = 1000) {
        let lastError;

        for (let i = 0; i < maxAttempts; i++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error;
                if (i < maxAttempts - 1) {
                    await this._sleep(delay);
                }
            }
        }

        throw lastError;
    }

    /**
     * Error handler
     */
    async _handleError(error, selector, options) {
        this.lastError = {
            error,
            selector,
            timestamp: new Date(),
            screenshot: null
        };

        if (options.screenshotOnError) {
            try {
                this.lastError.screenshot = await this.page.screenshot({
                    path: `error-${Date.now()}.png`
                });
            } catch {}
        }

        if (options.throwOnError !== false) {
            throw error;
        }
    }

    /**
     * Sleep helper
     */
    async _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get last error
     */
    getLastError() {
        return this.lastError;
    }
}

// ==================== XPATH BUILDER UTILITY ====================

class XPathBuilder {
    constructor() {
        this.parts = [];
    }

    // Start from root
    root() {
        this.parts = ['//'];
        return this;
    }

    // Any element
    any() {
        this.parts.push('*');
        return this;
    }

    // Specific tag
    tag(tagName) {
        this.parts.push(tagName);
        return this;
    }

    // By ID
    id(id) {
        this.parts.push(`[@id='${id}']`);
        return this;
    }

    // By class
    class(className) {
        this.parts.push(`[contains(@class, '${className}')]`);
        return this;
    }

    // By attribute
    attr(name, value) {
        if (value) {
            this.parts.push(`[@${name}='${value}']`);
        } else {
            this.parts.push(`[@${name}]`);
        }
        return this;
    }

    // Contains text
    text(text) {
        this.parts.push(`[contains(text(), '${text}')]`);
        return this;
    }

    // Exact text
    textExact(text) {
        this.parts.push(`[text()='${text}']`);
        return this;
    }

    // Child
    child(tag) {
        this.parts.push(`/${tag || '*'}`);
        return this;
    }

    // Descendant
    descendant(tag) {
        this.parts.push(`//${tag || '*'}`);
        return this;
    }

    // Parent
    parent() {
        this.parts.push('/..');
        return this;
    }

    // Following sibling
    followingSibling(tag) {
        this.parts.push(`/following-sibling::${tag || '*'}`);
        return this;
    }

    // Preceding sibling
    precedingSibling(tag) {
        this.parts.push(`/preceding-sibling::${tag || '*'}`);
        return this;
    }

    // Index (1-based)
    index(idx) {
        this.parts.push(`[${idx}]`);
        return this;
    }

    // Position
    position(pos) {
        this.parts.push(`[position()=${pos}]`);
        return this;
    }

    // Last
    last() {
        this.parts.push('[last()]');
        return this;
    }

    // First
    first() {
        this.parts.push('[1]');
        return this;
    }

    // Contains attribute
    containsAttr(attr, value) {
        this.parts.push(`[contains(@${attr}, '${value}')]`);
        return this;
    }

    // Starts with
    startsWith(attr, value) {
        this.parts.push(`[starts-with(@${attr}, '${value}')]`);
        return this;
    }

    // And condition
    and() {
        this.parts.push(' and ');
        return this;
    }

    // Or condition
    or() {
        this.parts.push(' or ');
        return this;
    }

    // Build final XPath
    build() {
        return this.parts.join('');
    }
}

// ==================== EXPORTS ====================

module.exports = {
    SelectorHelper,
    XPathBuilder
};