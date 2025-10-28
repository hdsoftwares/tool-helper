/**
 * XLogin Adapter
 * API adapter for XLogin platform
 * 
 * @author HD Software
 */

const BaseHttpClient = require('../base-http-client');
const PlatformType = require('../platform-type');

class XLoginAdapter extends BaseHttpClient {
    constructor(config) {
        super(config);
        this.platformType = PlatformType.XLOGIN;
    }

    async getFolders() {
        const response = await this.get('/api/v3/folders');
        const data = JSON.parse(response);

        return data.data.map(folder => ({
            id: folder.id,
            name: folder.name
        }));
    }

    async getProfiles(folderId) {
        const response = await this.get(`/api/v3/profiles?folder_id=${folderId}`);
        const data = JSON.parse(response);

        return data.data.map(profile => ({
            id: profile.id,
            name: profile.username || profile.note,
            folderId: profile.folderId,
            isRunning: profile.isRunning,
            proxy: profile.proxyString,
            note: profile.note
        }));
    }

    async createProfile(params) {
        const requestBody = {
            folderId: params.folderId,
            kernel: params.kernel || 'windows',
            proxyString: params.proxy || '',
            note: params.note || ''
        };

        const response = await this.post('/api/v3/profiles/create', requestBody);
        const data = JSON.parse(response);

        return {
            id: data.data.id,
            name: data.data.username || data.data.note,
            folderId: data.data.folderId,
            isRunning: data.data.isRunning,
            proxy: data.data.proxyString,
            note: data.data.note
        };
    }

    async startProfile(profileId) {
        const response = await this.get(`/api/v3/profiles/start/${profileId}`);
        const data = JSON.parse(response);

        return {
            debugPort: String(data.debugPort || ''),
            hwnd: String(data.hwnd || ''),
            success: data.success
        };
    }

    async stopProfile(profileId) {
        await this.get(`/api/v3/profiles/close/${profileId}`);
        return { success: true };
    }

    async deleteProfile(profileId) {
        await this.post(`/api/v3/profiles/delete/${profileId}`);
        return { success: true };
    }
}

module.exports = XLoginAdapter;