/**
 * GPMLogin Adapter
 * API adapter for GPMLogin platform
 * 
 * @author HD Software
 */

const BaseHttpClient = require('../base-http-client');
const PlatformType = require('../platform-type');

class GPMLoginAdapter extends BaseHttpClient {
    constructor(config) {
        super(config);
        this.platformType = PlatformType.GPM;
    }

    _extractPort(address) {
        const parts = address.split(':');
        return parts.length > 1 ? parts[1] : address;
    }

    async getFolders() {
        const response = await this.get('/api/v3/groups');
        const data = JSON.parse(response);

        return data.data.map(group => ({
            id: String(group.id),
            name: group.name
        }));
    }

    async getProfiles(folderId) {
        const response = await this.get(`/api/v3/profiles?group_id=${folderId}`);
        const data = JSON.parse(response);

        return data.data.map(profile => ({
            id: profile.id,
            name: profile.name,
            folderId: String(profile.group_id),
            isRunning: false,
            proxy: profile.raw_proxy,
            note: profile.note
        }));
    }
    async createProfile(params) {
        const requestBody = {
            group_id: params.folderId,
            name: params.name || 'New Profile',
            proxy: params.proxy || '',
            note: params.note || ''
        };
        const response = await this.post('/api/v3/profiles/create', requestBody);
        const data = JSON.parse(response);
        return {
            id: data.data.id,
            name: data.data.name,
            folderId: String(data.data.group_id),
            isRunning: false,
            proxy: data.data.proxy,
            note: data.data.note
        };
    }

    async startProfile(profileId, options = {}) {
        const { scale, width, height, x, y } = options;
        const win_scale = (typeof scale === 'number') ? scale : (options.win_scale || 0.5); // 0..1.0
        const win_size = options.win_size || ((width != null && height != null) ? `${width},${height}` : '700,900'); // width,height
        const win_pos = options.win_pos || ((x != null && y != null) ? `${x},${y}` : '300,300'); // x,y
        const response = await this.post(
            `/api/v3/profiles/start/${profileId}?win_scale=${win_scale}&win_size=${win_size}&win_pos=${win_pos}`
        );
        const data = JSON.parse(response);
        return {
            debugPort: this._extractPort(data.data.remote_debugging_address),
            success: data.success
        };
    }

    async stopProfile(profileId) {
        await this.post(`/api/v3/profiles/stop/${profileId}`);
        return { success: true };
    }

    async deleteProfile(profileId) {
        await this.delete(`/api/v3/profiles/${profileId}`);
        return { success: true };
    }
}

module.exports = GPMLoginAdapter;