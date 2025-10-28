/**
 * GoLogin Adapter
 * API adapter for GoLogin platform
 * 
 * @author HD Software
 */

const BaseHttpClient = require('../base-http-client');
const PlatformType = require('../platform-type');

class GoLoginAdapter extends BaseHttpClient {
    constructor(config) {
        super(config);
        this.platformType = PlatformType.GOLOGIN;
    }

    async getFolders() {
        const response = await this.get('/browser/folders');
        const data = JSON.parse(response);

        return data.folders.map(folder => ({
            id: folder.id,
            name: folder.name
        }));
    }

    async getProfiles(folderId) {
        const response = await this.get(`/browser?folder=${folderId}`);
        const data = JSON.parse(response);

        return data.profiles.map(profile => {
            let proxyString = '';
            if (profile.proxyEnabled && profile.proxy) {
                proxyString = `${profile.proxy.mode}://${profile.proxy.host}:${profile.proxy.port}`;
            }

            return {
                id: profile.id,
                name: profile.name,
                folderId: profile.folder,
                isRunning: profile.is_active,
                proxy: proxyString,
                note: profile.notes
            };
        });
    }

    async createProfile(params) {
        const requestBody = {
            name: params.name || 'New Profile',
            folder: params.folderId,
            notes: params.note || '',
            proxyEnabled: !!params.proxy
        };

        const response = await this.post('/browser', requestBody);
        const data = JSON.parse(response);

        return {
            id: data.id,
            name: data.name,
            folderId: data.folder,
            isRunning: false,
            note: data.notes
        };
    }

    async startProfile(profileId) {
        const response = await this.get(`/browser/${profileId}`);
        const data = JSON.parse(response);

        return {
            debugPort: String(data.port),
            success: true
        };
    }

    async stopProfile(profileId) {
        await this.post(`/browser/${profileId}/close`);
        return { success: true };
    }

    async deleteProfile(profileId) {
        await this.delete(`/browser/${profileId}`);
        return { success: true };
    }
}

module.exports = GoLoginAdapter;