/**
 * Telegram Bot API Module - Complete Implementation
 * Based on: https://core.telegram.org/bots/api
 * Supports: All message types, inline keyboards, formatting, files
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

class TelegramBot {
    constructor(botToken, options = {}) {
        if (!botToken) {
            throw new Error('Bot token is required');
        }

        this.botToken = botToken;
        this.baseUrl = `https://api.telegram.org/bot${botToken}`;

        this.config = {
            timeout: options.timeout || 30000,
            retryAttempts: options.retryAttempts || 3,
            retryDelay: options.retryDelay || 1000,
            defaultChatId: options.defaultChatId || null,
            defaultParseMode: options.defaultParseMode || 'HTML', // HTML, Markdown, MarkdownV2
            disableNotification: options.disableNotification || false,
            ...options
        };

        this.lastMessageId = null;
        this.lastError = null;
    }

    // ==================== CORE API METHODS ====================

    /**
     * Make API request to Telegram
     * @private
     */
    async _request(method, data = {}, isFormData = false) {
        const url = `${this.baseUrl}/${method}`;

        return await this._withRetry(async() => {
            return new Promise((resolve, reject) => {
                let postData;
                let headers = {};

                if (isFormData) {
                    postData = data;
                    headers = data.getHeaders();
                } else {
                    postData = JSON.stringify(data);
                    headers = {
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(postData)
                    };
                }

                const urlObj = new URL(url);
                const options = {
                    hostname: urlObj.hostname,
                    path: urlObj.pathname,
                    method: 'POST',
                    headers: headers,
                    timeout: this.config.timeout
                };

                const req = https.request(options, (res) => {
                    let body = '';

                    res.on('data', (chunk) => {
                        body += chunk;
                    });

                    res.on('end', () => {
                        try {
                            const response = JSON.parse(body);

                            if (response.ok) {
                                resolve(response.result);
                            } else {
                                reject(new Error(`Telegram API Error: ${response.description}`));
                            }
                        } catch (error) {
                            reject(new Error(`Parse error: ${error.message}`));
                        }
                    });
                });

                req.on('error', (error) => {
                    reject(error);
                });

                req.on('timeout', () => {
                    req.destroy();
                    reject(new Error('Request timeout'));
                });

                if (isFormData) {
                    postData.pipe(req);
                } else {
                    req.write(postData);
                    req.end();
                }
            });
        });
    }

    /**
     * Retry logic
     * @private
     */
    async _withRetry(fn) {
        let lastError;

        for (let i = 0; i < this.config.retryAttempts; i++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error;
                this.lastError = error;

                if (i < this.config.retryAttempts - 1) {
                    await this._sleep(this.config.retryDelay * (i + 1));
                }
            }
        }

        throw lastError;
    }

    /**
     * Sleep helper
     * @private
     */
    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Parse chat_id (có thể là số, string, hoặc default)
     * @private
     */
    _parseChatId(chatId) {
        if (chatId) return chatId;
        if (this.config.defaultChatId) return this.config.defaultChatId;
        throw new Error('chat_id is required');
    }

    // ==================== TEXT MESSAGES ====================

    /**
     * Send text message
     * @param {string|number} chatId - Chat ID or username
     * @param {string} text - Message text (max 4096 chars)
     * @param {object} options - Additional options
     */
    async sendMessage(chatId, text, options = {}) {
        const data = {
            chat_id: this._parseChatId(chatId),
            text: text,
            parse_mode: options.parse_mode || this.config.defaultParseMode,
            disable_web_page_preview: options.disable_web_page_preview || false,
            disable_notification: options.disable_notification || this.config.disableNotification,
            protect_content: options.protect_content || false,
            reply_to_message_id: options.reply_to_message_id || null,
            allow_sending_without_reply: options.allow_sending_without_reply || false,
            reply_markup: options.reply_markup || null
        };

        // Remove null values
        Object.keys(data).forEach(key => data[key] === null && delete data[key]);

        const result = await this._request('sendMessage', data);
        this.lastMessageId = result.message_id;
        return result;
    }

    /**
     * Send formatted message with HTML
     */
    async sendHTML(chatId, html, options = {}) {
        return await this.sendMessage(chatId, html, {
            ...options,
            parse_mode: 'HTML'
        });
    }

    /**
     * Send formatted message with Markdown
     */
    async sendMarkdown(chatId, markdown, options = {}) {
        return await this.sendMessage(chatId, markdown, {
            ...options,
            parse_mode: 'Markdown'
        });
    }

    /**
     * Send formatted message with MarkdownV2
     */
    async sendMarkdownV2(chatId, markdown, options = {}) {
        return await this.sendMessage(chatId, markdown, {
            ...options,
            parse_mode: 'MarkdownV2'
        });
    }

    // ==================== MEDIA MESSAGES ====================

    /**
     * Send photo
     * @param {string|number} chatId
     * @param {string|Buffer} photo - File path, URL, or Buffer
     * @param {object} options
     */
    async sendPhoto(chatId, photo, options = {}) {
        const isFile = typeof photo === 'string' && fs.existsSync(photo);
        const isBuffer = Buffer.isBuffer(photo);

        if (isFile || isBuffer) {
            // Upload file
            const form = new FormData();
            form.append('chat_id', this._parseChatId(chatId));

            if (isFile) {
                form.append('photo', fs.createReadStream(photo));
            } else {
                form.append('photo', photo, { filename: 'photo.jpg' });
            }

            if (options.caption) form.append('caption', options.caption);
            if (options.parse_mode) form.append('parse_mode', options.parse_mode);
            if (options.disable_notification) form.append('disable_notification', 'true');
            if (options.reply_markup) form.append('reply_markup', JSON.stringify(options.reply_markup));

            const result = await this._request('sendPhoto', form, true);
            this.lastMessageId = result.message_id;
            return result;
        } else {
            // URL or file_id
            const data = {
                chat_id: this._parseChatId(chatId),
                photo: photo,
                caption: options.caption || null,
                parse_mode: options.parse_mode || this.config.defaultParseMode,
                disable_notification: options.disable_notification || this.config.disableNotification,
                reply_markup: options.reply_markup || null
            };

            Object.keys(data).forEach(key => data[key] === null && delete data[key]);

            const result = await this._request('sendPhoto', data);
            this.lastMessageId = result.message_id;
            return result;
        }
    }

    /**
     * Send document/file
     */
    async sendDocument(chatId, document, options = {}) {
        const isFile = typeof document === 'string' && fs.existsSync(document);
        const isBuffer = Buffer.isBuffer(document);

        if (isFile || isBuffer) {
            const form = new FormData();
            form.append('chat_id', this._parseChatId(chatId));

            if (isFile) {
                form.append('document', fs.createReadStream(document));
            } else {
                const filename = options.filename || 'document.txt';
                form.append('document', document, { filename });
            }

            if (options.caption) form.append('caption', options.caption);
            if (options.parse_mode) form.append('parse_mode', options.parse_mode);
            if (options.disable_notification) form.append('disable_notification', 'true');
            if (options.reply_markup) form.append('reply_markup', JSON.stringify(options.reply_markup));

            const result = await this._request('sendDocument', form, true);
            this.lastMessageId = result.message_id;
            return result;
        } else {
            const data = {
                chat_id: this._parseChatId(chatId),
                document: document,
                caption: options.caption || null,
                parse_mode: options.parse_mode || this.config.defaultParseMode,
                disable_notification: options.disable_notification || this.config.disableNotification,
                reply_markup: options.reply_markup || null
            };

            Object.keys(data).forEach(key => data[key] === null && delete data[key]);

            const result = await this._request('sendDocument', data);
            this.lastMessageId = result.message_id;
            return result;
        }
    }

    /**
     * Send video
     */
    async sendVideo(chatId, video, options = {}) {
        const isFile = typeof video === 'string' && fs.existsSync(video);

        if (isFile) {
            const form = new FormData();
            form.append('chat_id', this._parseChatId(chatId));
            form.append('video', fs.createReadStream(video));

            if (options.caption) form.append('caption', options.caption);
            if (options.duration) form.append('duration', options.duration);
            if (options.width) form.append('width', options.width);
            if (options.height) form.append('height', options.height);
            if (options.parse_mode) form.append('parse_mode', options.parse_mode);
            if (options.supports_streaming) form.append('supports_streaming', 'true');
            if (options.disable_notification) form.append('disable_notification', 'true');

            const result = await this._request('sendVideo', form, true);
            this.lastMessageId = result.message_id;
            return result;
        } else {
            const data = {
                chat_id: this._parseChatId(chatId),
                video: video,
                caption: options.caption || null,
                parse_mode: options.parse_mode || this.config.defaultParseMode,
                duration: options.duration || null,
                width: options.width || null,
                height: options.height || null,
                supports_streaming: options.supports_streaming || null,
                disable_notification: options.disable_notification || this.config.disableNotification
            };

            Object.keys(data).forEach(key => data[key] === null && delete data[key]);

            const result = await this._request('sendVideo', data);
            this.lastMessageId = result.message_id;
            return result;
        }
    }

    /**
     * Send audio
     */
    async sendAudio(chatId, audio, options = {}) {
        const isFile = typeof audio === 'string' && fs.existsSync(audio);

        if (isFile) {
            const form = new FormData();
            form.append('chat_id', this._parseChatId(chatId));
            form.append('audio', fs.createReadStream(audio));

            if (options.caption) form.append('caption', options.caption);
            if (options.duration) form.append('duration', options.duration);
            if (options.performer) form.append('performer', options.performer);
            if (options.title) form.append('title', options.title);
            if (options.parse_mode) form.append('parse_mode', options.parse_mode);

            const result = await this._request('sendAudio', form, true);
            this.lastMessageId = result.message_id;
            return result;
        } else {
            const data = {
                chat_id: this._parseChatId(chatId),
                audio: audio,
                caption: options.caption || null,
                duration: options.duration || null,
                performer: options.performer || null,
                title: options.title || null,
                parse_mode: options.parse_mode || this.config.defaultParseMode
            };

            Object.keys(data).forEach(key => data[key] === null && delete data[key]);

            const result = await this._request('sendAudio', data);
            this.lastMessageId = result.message_id;
            return result;
        }
    }

    /**
     * Send voice message
     */
    async sendVoice(chatId, voice, options = {}) {
        const isFile = typeof voice === 'string' && fs.existsSync(voice);

        if (isFile) {
            const form = new FormData();
            form.append('chat_id', this._parseChatId(chatId));
            form.append('voice', fs.createReadStream(voice));

            if (options.caption) form.append('caption', options.caption);
            if (options.duration) form.append('duration', options.duration);
            if (options.parse_mode) form.append('parse_mode', options.parse_mode);

            return await this._request('sendVoice', form, true);
        } else {
            const data = {
                chat_id: this._parseChatId(chatId),
                voice: voice,
                caption: options.caption || null,
                duration: options.duration || null,
                parse_mode: options.parse_mode || this.config.defaultParseMode
            };

            Object.keys(data).forEach(key => data[key] === null && delete data[key]);

            return await this._request('sendVoice', data);
        }
    }

    /**
     * Send animation (GIF, etc)
     */
    async sendAnimation(chatId, animation, options = {}) {
        const isFile = typeof animation === 'string' && fs.existsSync(animation);

        if (isFile) {
            const form = new FormData();
            form.append('chat_id', this._parseChatId(chatId));
            form.append('animation', fs.createReadStream(animation));

            if (options.caption) form.append('caption', options.caption);
            if (options.duration) form.append('duration', options.duration);
            if (options.width) form.append('width', options.width);
            if (options.height) form.append('height', options.height);

            return await this._request('sendAnimation', form, true);
        } else {
            const data = {
                chat_id: this._parseChatId(chatId),
                animation: animation,
                caption: options.caption || null,
                duration: options.duration || null,
                width: options.width || null,
                height: options.height || null
            };

            Object.keys(data).forEach(key => data[key] === null && delete data[key]);

            return await this._request('sendAnimation', data);
        }
    }

    /**
     * Send location
     */
    async sendLocation(chatId, latitude, longitude, options = {}) {
        const data = {
            chat_id: this._parseChatId(chatId),
            latitude: latitude,
            longitude: longitude,
            horizontal_accuracy: options.horizontal_accuracy || null,
            live_period: options.live_period || null,
            heading: options.heading || null,
            proximity_alert_radius: options.proximity_alert_radius || null,
            disable_notification: options.disable_notification || this.config.disableNotification,
            reply_markup: options.reply_markup || null
        };

        Object.keys(data).forEach(key => data[key] === null && delete data[key]);

        return await this._request('sendLocation', data);
    }

    /**
     * Send contact
     */
    async sendContact(chatId, phoneNumber, firstName, options = {}) {
        const data = {
            chat_id: this._parseChatId(chatId),
            phone_number: phoneNumber,
            first_name: firstName,
            last_name: options.last_name || null,
            vcard: options.vcard || null,
            disable_notification: options.disable_notification || this.config.disableNotification,
            reply_markup: options.reply_markup || null
        };

        Object.keys(data).forEach(key => data[key] === null && delete data[key]);

        return await this._request('sendContact', data);
    }

    /**
     * Send poll
     */
    async sendPoll(chatId, question, options, pollOptions = {}) {
        const data = {
            chat_id: this._parseChatId(chatId),
            question: question,
            options: options,
            is_anonymous: pollOptions.is_anonymous !== false,
            type: pollOptions.type || 'regular', // regular or quiz
            allows_multiple_answers: pollOptions.allows_multiple_answers || false,
            correct_option_id: pollOptions.correct_option_id || null,
            explanation: pollOptions.explanation || null,
            explanation_parse_mode: pollOptions.explanation_parse_mode || null,
            open_period: pollOptions.open_period || null,
            close_date: pollOptions.close_date || null,
            is_closed: pollOptions.is_closed || false,
            disable_notification: pollOptions.disable_notification || this.config.disableNotification,
            reply_markup: pollOptions.reply_markup || null
        };

        Object.keys(data).forEach(key => data[key] === null && delete data[key]);

        return await this._request('sendPoll', data);
    }

    /**
     * Send dice 🎲
     */
    async sendDice(chatId, options = {}) {
        const data = {
            chat_id: this._parseChatId(chatId),
            emoji: options.emoji || '🎲', // 🎲 🎯 🏀 ⚽ 🎳 🎰
            disable_notification: options.disable_notification || this.config.disableNotification,
            reply_markup: options.reply_markup || null
        };

        Object.keys(data).forEach(key => data[key] === null && delete data[key]);

        return await this._request('sendDice', data);
    }

    // ==================== INLINE KEYBOARDS & BUTTONS ====================

    /**
     * Create inline keyboard
     * @param {array} buttons - Array of button rows
     * @returns {object} Inline keyboard markup
     */
    createInlineKeyboard(buttons) {
        return {
            inline_keyboard: buttons
        };
    }

    /**
     * Create inline button
     */
    createInlineButton(text, options = {}) {
        const button = { text };

        if (options.url) {
            button.url = options.url;
        } else if (options.callback_data) {
            button.callback_data = options.callback_data;
        } else if (options.switch_inline_query) {
            button.switch_inline_query = options.switch_inline_query;
        } else if (options.switch_inline_query_current_chat) {
            button.switch_inline_query_current_chat = options.switch_inline_query_current_chat;
        }

        return button;
    }

    /**
     * Create reply keyboard
     */
    createReplyKeyboard(buttons, options = {}) {
        return {
            keyboard: buttons,
            resize_keyboard: options.resize_keyboard !== false,
            one_time_keyboard: options.one_time_keyboard || false,
            selective: options.selective || false
        };
    }

    /**
     * Remove keyboard
     */
    createRemoveKeyboard(selective = false) {
        return {
            remove_keyboard: true,
            selective: selective
        };
    }

    /**
     * Force reply
     */
    createForceReply(selective = false) {
        return {
            force_reply: true,
            selective: selective
        };
    }

    // ==================== MESSAGE MANAGEMENT ====================

    /**
     * Edit message text
     */
    async editMessageText(chatId, messageId, text, options = {}) {
        const data = {
            chat_id: this._parseChatId(chatId),
            message_id: messageId,
            text: text,
            parse_mode: options.parse_mode || this.config.defaultParseMode,
            disable_web_page_preview: options.disable_web_page_preview || false,
            reply_markup: options.reply_markup || null
        };

        Object.keys(data).forEach(key => data[key] === null && delete data[key]);

        return await this._request('editMessageText', data);
    }

    /**
     * Edit inline keyboard
     */
    async editMessageReplyMarkup(chatId, messageId, replyMarkup) {
        const data = {
            chat_id: this._parseChatId(chatId),
            message_id: messageId,
            reply_markup: replyMarkup
        };

        return await this._request('editMessageReplyMarkup', data);
    }

    /**
     * Delete message
     */
    async deleteMessage(chatId, messageId) {
        const data = {
            chat_id: this._parseChatId(chatId),
            message_id: messageId
        };

        return await this._request('deleteMessage', data);
    }

    /**
     * Forward message
     */
    async forwardMessage(chatId, fromChatId, messageId, options = {}) {
        const data = {
            chat_id: this._parseChatId(chatId),
            from_chat_id: fromChatId,
            message_id: messageId,
            disable_notification: options.disable_notification || this.config.disableNotification,
            protect_content: options.protect_content || false
        };

        return await this._request('forwardMessage', data);
    }

    /**
     * Copy message
     */
    async copyMessage(chatId, fromChatId, messageId, options = {}) {
        const data = {
            chat_id: this._parseChatId(chatId),
            from_chat_id: fromChatId,
            message_id: messageId,
            caption: options.caption || null,
            parse_mode: options.parse_mode || null,
            disable_notification: options.disable_notification || this.config.disableNotification,
            protect_content: options.protect_content || false,
            reply_markup: options.reply_markup || null
        };

        Object.keys(data).forEach(key => data[key] === null && delete data[key]);

        return await this._request('copyMessage', data);
    }

    // ==================== CHAT ACTIONS ====================

    /**
     * Send chat action (typing, upload_photo, etc)
     */
    async sendChatAction(chatId, action) {
        // Actions: typing, upload_photo, record_video, upload_video, 
        //          record_voice, upload_voice, upload_document, 
        //          choose_sticker, find_location, record_video_note, upload_video_note

        const data = {
            chat_id: this._parseChatId(chatId),
            action: action
        };

        return await this._request('sendChatAction', data);
    }

    /**
     * Show typing indicator
     */
    async sendTyping(chatId) {
        return await this.sendChatAction(chatId, 'typing');
    }

    /**
     * Show uploading photo indicator
     */
    async sendUploadPhoto(chatId) {
        return await this.sendChatAction(chatId, 'upload_photo');
    }

    /**
     * Show uploading document indicator
     */
    async sendUploadDocument(chatId) {
        return await this.sendChatAction(chatId, 'upload_document');
    }

    // ==================== BOT INFO ====================

    /**
     * Get bot info
     */
    async getMe() {
        return await this._request('getMe');
    }

    /**
     * Get chat info
     */
    async getChat(chatId) {
        const data = {
            chat_id: this._parseChatId(chatId)
        };

        return await this._request('getChat', data);
    }

    /**
     * Get chat member count
     */
    async getChatMemberCount(chatId) {
        const data = {
            chat_id: this._parseChatId(chatId)
        };

        return await this._request('getChatMemberCount', data);
    }

    /**
     * Get file info and download URL
     */
    async getFile(fileId) {
        const data = {
            file_id: fileId
        };

        const result = await this._request('getFile', data);
        result.download_url = `https://api.telegram.org/file/bot${this.botToken}/${result.file_path}`;
        return result;
    }

    // ==================== HELPER METHODS ====================

    /**
     * Get last message ID
     */
    getLastMessageId() {
        return this.lastMessageId;
    }

    /**
     * Get last error
     */
    getLastError() {
        return this.lastError;
    }

    /**
     * Set default chat ID
     */
    setDefaultChatId(chatId) {
        this.config.defaultChatId = chatId;
    }

    /**
     * Escape HTML special characters
     */
    escapeHTML(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    /**
     * Escape Markdown special characters
     */
    escapeMarkdown(text) {
        return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
    }

    /**
     * Format text with HTML
     */
    formatHTML(text, options = {}) {
        let formatted = text;

        if (options.bold) formatted = `<b>${formatted}</b>`;
        if (options.italic) formatted = `<i>${formatted}</i>`;
        if (options.underline) formatted = `<u>${formatted}</u>`;
        if (options.strike) formatted = `<s>${formatted}</s>`;
        if (options.code) formatted = `<code>${formatted}</code>`;
        if (options.pre) formatted = `<pre>${formatted}</pre>`;
        if (options.link) formatted = `<a href="${options.link}">${formatted}</a>`;

        return formatted;
    }
}

// ==================== EXPORTS ====================

module.exports = TelegramBot;

// ==================== USAGE EXAMPLES ====================

/*
// Example 1: Basic text message
const bot = new TelegramBot('YOUR_BOT_TOKEN', {
  defaultChatId: 'YOUR_CHAT_ID'
});

await bot.sendMessage(null, 'Hello from automation bot!');

// Example 2: HTML formatted message
await bot.sendHTML(null, `
  <b>Bot Report</b>
  <i>Status:</i> ✅ Running
  <code>Tasks completed: 150</code>
  <a href="https://example.com">View Details</a>
`);

// Example 3: Markdown message
await bot.sendMarkdown(null, `
*Task Completed*
_Status:_ Success
\`Error count: 0\`
[View Report](https://example.com)
`);

// Example 4: Send photo with caption
await bot.sendPhoto(null, './screenshot.png', {
  caption: '<b>Screenshot</b>\nCaptured at: ' + new Date().toISOString(),
  parse_mode: 'HTML'
});

// Example 5: Send document
await bot.sendDocument(null, './report.pdf', {
  caption: 'Daily report generated'
});

// Example 6: Send photo from URL
await bot.sendPhoto(null, 'https://example.com/image.jpg', {
  caption: 'Image from URL'
});

// Example 7: Inline keyboard
const keyboard = bot.createInlineKeyboard([
  [
    bot.createInlineButton('✅ Approve', { callback_data: 'approve' }),
    bot.createInlineButton('❌ Reject', { callback_data: 'reject' })
  ],
  [
    bot.createInlineButton('📊 View Details', { url: 'https://example.com/details' })
  ]
]);

await bot.sendMessage(null, 'Please review this action:', {
  reply_markup: keyboard
});

// Example 8: Progress notification
await bot.sendTyping(null);
await new Promise(r => setTimeout(r, 1000));
await bot.sendMessage(null, 'Processing complete!');

// Example 9: Edit message
const msg = await bot.sendMessage(null, 'Processing... 0%');
await new Promise(r => setTimeout(r, 2000));
await bot.editMessageText(null, msg.message_id, 'Processing... 50%');
await new Promise(r => setTimeout(r, 2000));
await bot.editMessageText(null, msg.message_id, 'Processing... 100% ✅');

// Example 10: Send poll
await bot.sendPoll(null, 'How is the bot performing?', [
  'Excellent',
  'Good',
  'Average',
  'Poor'
], {
  is_anonymous: false,
  allows_multiple_answers: false
});

// Example 11: Send location
await bot.sendLocation(null, 10.762622, 106.660172, {
  // Vung Tau coordinates
});

// Example 12: Error notification with screenshot
try {
  // Your automation code
} catch (error) {
  await bot.sendPhoto(null, './error-screenshot.png', {
    caption: `
<b>❌ Error Occurred</b>
<code>${bot.escapeHTML(error.message)}</code>

Time: ${new Date().toISOString()}
Stack: <pre>${bot.escapeHTML(error.stack)}</pre>
    `,
    parse_mode: 'HTML'
  });
}

// Example 13: Batch notifications
const results = [
  { task: 'Login', status: 'success' },
  { task: 'Scrape data', status: 'success' },
  { task: 'Save file', status: 'failed' }
];

let report = '<b>📊 Automation Report</b>\n\n';
results.forEach(r => {
  const icon = r.status === 'success' ? '✅' : '❌';
  report += `${icon} ${r.task}: <code>${r.status}</code>\n`;
});

await bot.sendHTML(null, report);

// Example 14: Send multiple photos as album (media group)
const mediaGroup = [
  {
    type: 'photo',
    media: 'https://example.com/image1.jpg',
    caption: 'Image 1'
  },
  {
    type: 'photo',
    media: 'https://example.com/image2.jpg',
    caption: 'Image 2'
  }
];

await bot.sendMediaGroup(null, mediaGroup);

// Example 15: Reply keyboard
const replyKeyboard = bot.createReplyKeyboard([
  ['Start Bot', 'Stop Bot'],
  ['Check Status', 'View Logs'],
  ['Settings']
], {
  resize_keyboard: true,
  one_time_keyboard: false
});

await bot.sendMessage(null, 'Choose an action:', {
  reply_markup: replyKeyboard
});

// Example 16: Remove keyboard
await bot.sendMessage(null, 'Keyboard removed', {
  reply_markup: bot.createRemoveKeyboard()
});

// Example 17: Send video
await bot.sendVideo(null, './recording.mp4', {
  caption: 'Screen recording',
  supports_streaming: true
});

// Example 18: Send audio file
await bot.sendAudio(null, './audio.mp3', {
  title: 'Notification Sound',
  performer: 'Bot',
  duration: 5
});

// Example 19: Send dice game
await bot.sendDice(null, { emoji: '🎲' });
await bot.sendDice(null, { emoji: '🎯' });
await bot.sendDice(null, { emoji: '🏀' });

// Example 20: Complex automation report
async function sendAutomationReport(bot, data) {
  // Send typing indicator
  await bot.sendTyping(null);
  
  // Prepare report
  const report = `
<b>🤖 Automation Report</b>
<b>━━━━━━━━━━━━━━━━━━</b>

📅 Date: <code>${new Date().toLocaleDateString()}</code>
⏰ Time: <code>${new Date().toLocaleTimeString()}</code>

<b>📊 Statistics:</b>
• Tasks Completed: <code>${data.tasksCompleted}</code>
• Success Rate: <code>${data.successRate}%</code>
• Total Time: <code>${data.totalTime}s</code>

<b>💰 Results:</b>
• Items Scraped: <code>${data.itemsScraped}</code>
• Data Saved: <code>${data.dataSaved} MB</code>

${data.errors > 0 ? `<b>⚠️ Errors: ${data.errors}</b>` : '<b>✅ No Errors</b>'}
  `;
  
  // Create action buttons
  const keyboard = bot.createInlineKeyboard([
    [
      bot.createInlineButton('📥 Download Data', { url: data.downloadUrl }),
      bot.createInlineButton('🔄 Restart', { callback_data: 'restart' })
    ],
    [
      bot.createInlineButton('📈 View Analytics', { url: data.analyticsUrl })
    ]
  ]);
  
  // Send report with keyboard
  await bot.sendHTML(null, report, {
    reply_markup: keyboard,
    disable_web_page_preview: true
  });
  
  // Send screenshot if available
  if (data.screenshotPath) {
    await bot.sendPhoto(null, data.screenshotPath, {
      caption: '📸 Latest Screenshot'
    });
  }
}

// Usage
await sendAutomationReport(bot, {
  tasksCompleted: 150,
  successRate: 98.5,
  totalTime: 3600,
  itemsScraped: 1250,
  dataSaved: 45.2,
  errors: 2,
  downloadUrl: 'https://example.com/download/data.csv',
  analyticsUrl: 'https://example.com/analytics',
  screenshotPath: './final-screenshot.png'
});

// Example 21: Error handler wrapper
async function runWithTelegramNotification(bot, taskName, fn) {
  const startTime = Date.now();
  
  try {
    await bot.sendMessage(null, `🚀 Starting: ${taskName}`);
    
    const result = await fn();
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    await bot.sendHTML(null, `
✅ <b>Completed: ${taskName}</b>
⏱ Duration: <code>${duration}s</code>
    `);
    
    return result;
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    await bot.sendHTML(null, `
❌ <b>Failed: ${taskName}</b>
⏱ Duration: <code>${duration}s</code>
🔴 Error: <code>${bot.escapeHTML(error.message)}</code>
    `);
    
    throw error;
  }
}

// Usage
await runWithTelegramNotification(bot, 'Scrape Products', async () => {
  // Your scraping code here
  await scrapeProducts();
});

// Example 22: Progress tracker
class ProgressTracker {
  constructor(bot, chatId, total) {
    this.bot = bot;
    this.chatId = chatId;
    this.total = total;
    this.current = 0;
    this.messageId = null;
    this.startTime = Date.now();
  }
  
  async start() {
    const msg = await this.bot.sendMessage(this.chatId, this._formatProgress());
    this.messageId = msg.message_id;
  }
  
  async update(current) {
    this.current = current;
    
    if (this.messageId) {
      try {
        await this.bot.editMessageText(
          this.chatId, 
          this.messageId, 
          this._formatProgress()
        );
      } catch (error) {
        // Ignore rate limit errors
      }
    }
  }
  
  async complete() {
    const duration = ((Date.now() - this.startTime) / 1000).toFixed(2);
    
    await this.bot.editMessageText(
      this.chatId,
      this.messageId,
      `✅ Complete!\nProcessed: ${this.total} items\nTime: ${duration}s`
    );
  }
  
  _formatProgress() {
    const percent = ((this.current / this.total) * 100).toFixed(1);
    const barLength = 20;
    const filled = Math.floor((this.current / this.total) * barLength);
    const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled);
    
    return `⏳ Processing...\n${bar} ${percent}%\n${this.current}/${this.total} items`;
  }
}

// Usage
const tracker = new ProgressTracker(bot, 'YOUR_CHAT_ID', 100);
await tracker.start();

for (let i = 0; i < 100; i++) {
  // Do work
  await processItem(i);
  
  // Update every 5 items to avoid rate limits
  if (i % 5 === 0) {
    await tracker.update(i + 1);
  }
}

await tracker.complete();

// Example 23: Send media group (album)
async sendMediaGroup(chatId, media, options = {}) {
  const data = {
    chat_id: this._parseChatId(chatId),
    media: media,
    disable_notification: options.disable_notification || this.config.disableNotification,
    protect_content: options.protect_content || false
  };
  
  return await this._request('sendMediaGroup', data);
}

// Usage
await bot.sendMediaGroup(null, [
  {
    type: 'photo',
    media: './screenshot1.png',
    caption: 'Page 1'
  },
  {
    type: 'photo',
    media: './screenshot2.png',
    caption: 'Page 2'
  }
]);

// Example 24: Schedule notification (requires external scheduler)
async function scheduleReport(bot, cronTime) {
  // Using node-cron or similar
  const cron = require('node-cron');
  
  cron.schedule(cronTime, async () => {
    const stats = await getAutomationStats();
    
    await bot.sendHTML(null, `
<b>📊 Scheduled Report</b>

Today's Stats:
• Runs: <code>${stats.runs}</code>
• Success: <code>${stats.success}</code>
• Failed: <code>${stats.failed}</code>
    `);
  });
}

// Run every day at 9 AM
scheduleReport(bot, '0 9 * * *');

// Example 25: Handle bot commands (webhook setup required)
const express = require('express');
const app = express();

app.use(express.json());

app.post('/webhook', async (req, res) => {
  const update = req.body;
  
  if (update.message) {
    const chatId = update.message.chat.id;
    const text = update.message.text;
    
    if (text === '/start') {
      await bot.sendMessage(chatId, 'Welcome! Bot is ready.');
    } else if (text === '/status') {
      await bot.sendMessage(chatId, 'Bot is running smoothly!');
    } else if (text === '/help') {
      await bot.sendMessage(chatId, `
Available commands:
/start - Start bot
/status - Check status
/report - Get latest report
/help - Show this message
      `);
    }
  }
  
  res.sendStatus(200);
});

app.listen(3000);

// Example 26: Formatting helpers
const formatted = bot.formatHTML('Important Message', {
  bold: true,
  italic: false
});

await bot.sendMessage(null, formatted);

// Example 27: Multi-chat broadcast
async function broadcast(bot, chatIds, message) {
  const results = [];
  
  for (const chatId of chatIds) {
    try {
      await bot.sendMessage(chatId, message);
      results.push({ chatId, status: 'sent' });
      
      // Delay to avoid rate limits (30 messages per second)
      await new Promise(r => setTimeout(r, 100));
    } catch (error) {
      results.push({ chatId, status: 'failed', error: error.message });
    }
  }
  
  return results;
}

// Usage
const chatIds = ['123456789', '987654321', '555555555'];
await broadcast(bot, chatIds, 'System maintenance in 10 minutes');

// Example 28: File size check before upload
async function sendLargeFile(bot, chatId, filePath) {
  const stats = require('fs').statSync(filePath);
  const fileSizeMB = stats.size / (1024 * 1024);
  
  if (fileSizeMB > 50) {
    await bot.sendMessage(chatId, `File too large: ${fileSizeMB.toFixed(2)}MB`);
    return false;
  }
  
  await bot.sendUploadDocument(chatId);
  await bot.sendDocument(chatId, filePath);
  return true;
}

// Example 29: Get bot info
const botInfo = await bot.getMe();
console.log('Bot Username:', botInfo.username);
console.log('Bot Name:', botInfo.first_name);

// Example 30: Advanced error handling
class TelegramNotifier {
  constructor(bot) {
    this.bot = bot;
    this.errorCount = 0;
    this.lastErrorTime = null;
  }
  
  async notifyError(error, context = {}) {
    this.errorCount++;
    this.lastErrorTime = new Date();
    
    // Take screenshot if in browser context
    let screenshotPath = null;
    if (context.page) {
      screenshotPath = `./error-${Date.now()}.png`;
      await context.page.screenshot({ path: screenshotPath });
    }
    
    // Send error details
    await this.bot.sendHTML(null, `
<b>🔴 Error #${this.errorCount}</b>
━━━━━━━━━━━━━━━━━━

<b>Message:</b>
<code>${this.bot.escapeHTML(error.message)}</code>

<b>Context:</b>
${Object.entries(context).map(([k, v]) => `• ${k}: <code>${v}</code>`).join('\n')}

<b>Time:</b> ${this.lastErrorTime.toISOString()}
    `);
    
    // Send screenshot if available
    if (screenshotPath) {
      await this.bot.sendPhoto(null, screenshotPath, {
        caption: '📸 Error Screenshot'
      });
    }
    
    // Send stack trace as document
    const stackFile = Buffer.from(error.stack);
    await this.bot.sendDocument(null, stackFile, {
      filename: `error-stack-${Date.now()}.txt`,
      caption: 'Stack Trace'
    });
  }
  
  async notifySuccess(message, data = {}) {
    await this.bot.sendHTML(null, `
<b>✅ Success</b>

${message}

${Object.entries(data).map(([k, v]) => `• ${k}: <code>${v}</code>`).join('\n')}
    `);
  }
}

// Usage
const notifier = new TelegramNotifier(bot);

try {
  await automationTask();
  await notifier.notifySuccess('Task completed', {
    duration: '120s',
    items: 500
  });
} catch (error) {
  await notifier.notifyError(error, {
    task: 'automationTask',
    url: 'https://example.com',
    user: 'admin'
  });
}
*/