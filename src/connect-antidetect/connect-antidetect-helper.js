/**
 * ConnectAntidetectHelper
 * Unified interface for managing antidetect browser platforms
 * Supports: XLogin, GPM Login, GoLogin
 * 
 * @author HD Software
 * @version 1.0.0
 */

// ===========================================
// Imports
// ===========================================

const PlatformType = require('./platform-type');
const XLoginAdapter = require('./adapters/xlogin-adapter');
const GPMLoginAdapter = require('./adapters/gpm-adapter');
const GoLoginAdapter = require('./adapters/gologin-adapter');

// ===========================================
// Main Helper Class
// ===========================================

class ConnectAntidetectHelper {
    constructor(config) {
        this._validateConfig(config);

        this.config = {
            type: config.type,
            baseUrl: config.baseUrl,
            apiKey: config.apiKey || '',
            timeout: config.timeout || 30000
        };

        this.adapter = this._createAdapter();
    }

    _validateConfig(config) {
        if (!config || typeof config !== 'object') {
            throw new Error('Config object is required');
        }

        if (!config.type) {
            throw new Error('Platform type is required');
        }

        if (!config.baseUrl) {
            throw new Error('Base URL is required');
        }

        const validTypes = Object.values(PlatformType);
        if (!validTypes.includes(config.type.toLowerCase())) {
            throw new Error(
                `Invalid platform type. Supported: ${validTypes.join(', ')}`
            );
        }
    }

    _createAdapter() {
        const type = this.config.type.toLowerCase();

        switch (type) {
            case PlatformType.XLOGIN:
                return new XLoginAdapter(this.config);
            case PlatformType.GPM:
                return new GPMLoginAdapter(this.config);
            case PlatformType.GOLOGIN:
                return new GoLoginAdapter(this.config);
            default:
                throw new Error(`Unsupported platform: ${type}`);
        }
    }

    // ===========================================
    // Public API Methods
    // ===========================================

    /**
     * Get all folders/groups from the platform
     * @returns {Promise<Array<{id: string, name: string}>>}
     */
    async getFolders() {
        return await this.adapter.getFolders();
    }

    /**
     * Get all profiles in a specific folder
     * @param {string} folderId - Folder/Group ID
     * @returns {Promise<Array<Profile>>}
     */
    async getProfiles(folderId) {
        if (!folderId) {
            throw new Error('Folder ID is required');
        }
        return await this.adapter.getProfiles(folderId);
    }

    /**
     * Create a new profile
     * @param {Object} params - Profile parameters
     * @param {string} params.folderId - Folder/Group ID
     * @param {string} [params.name] - Profile name
     * @param {string} [params.proxy] - Proxy string
     * @param {string} [params.note] - Profile note
     * @returns {Promise<Profile>}
     */
    async createProfile(params) {
        if (!params || !params.folderId) {
            throw new Error('Folder ID is required');
        }
        return await this.adapter.createProfile(params);
    }

    /**
     * Start/Launch a profile
     * @param {string} profileId - Profile ID
     * @param {Object} [options] - Platform-specific options
     * @returns {Promise<{debugPort: string, success: boolean}>}
     */
    async startProfile(profileId, options = {}) {
        if (!profileId) {
            throw new Error('Profile ID is required');
        }
        return await this.adapter.startProfile(profileId, options);
    }

    /**
     * Stop/Close a profile
     * @param {string} profileId - Profile ID
     * @returns {Promise<{success: boolean}>}
     */
    async stopProfile(profileId) {
        if (!profileId) {
            throw new Error('Profile ID is required');
        }
        return await this.adapter.stopProfile(profileId);
    }

    /**
     * Delete a profile permanently
     * @param {string} profileId - Profile ID
     * @returns {Promise<{success: boolean}>}
     */
    async deleteProfile(profileId) {
        if (!profileId) {
            throw new Error('Profile ID is required');
        }
        return await this.adapter.deleteProfile(profileId);
    }

    /**
     * Get platform type
     * @returns {string}
     */
    getPlatformType() {
        return this.adapter.platformType;
    }

    /**
     * Get connection info
     * @returns {Object}
     */
    getConnectionInfo() {
        return {
            platform: this.adapter.platformType,
            baseUrl: this.config.baseUrl,
            hasApiKey: !!this.config.apiKey,
            timeout: this.config.timeout
        };
    }

    // ===========================================
    // Static Helper Methods
    // ===========================================

    /**
     * Get list of supported platforms
     * @returns {Array<string>}
     */
    static getSupportedPlatforms() {
        return Object.values(PlatformType);
    }

    /**
     * Check if a platform is supported
     * @param {string} platformType
     * @returns {boolean}
     */
    static isPlatformSupported(platformType) {
        return Object.values(PlatformType).includes(platformType.toLowerCase());
    }

    /**
     * Create helper instance (alternative constructor)
     * @param {Object} config
     * @returns {ConnectAntidetectHelper}
     */
    static create(config) {
        return new ConnectAntidetectHelper(config);
    }
}

// ===========================================
// Exports
// ===========================================

module.exports = {
    ConnectAntidetectHelper,
    PlatformType,

    // Convenience exports
    default: ConnectAntidetectHelper
};

// Type definitions for better IDE support
/**
 * @typedef {Object} Profile
 * @property {string} id - Profile ID
 * @property {string} name - Profile name
 * @property {string} folderId - Folder/Group ID
 * @property {boolean} isRunning - Running status
 * @property {string} proxy - Proxy string
 * @property {string} note - Profile note
 */

/**
 * @typedef {Object} StartProfileResult
 * @property {string} debugPort - Chrome debug port
 * @property {boolean} success - Operation success
 * @property {string} [hwnd] - Window handle (XLogin only)
 */