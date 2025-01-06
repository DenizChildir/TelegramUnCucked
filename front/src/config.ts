// config.ts
export const CONFIG = {
    // Server configuration
    SERVER: {
        // Since we're using Vite's proxy, we use the relative path
        HOST: window.location.hostname,  // This will resolve correctly through the proxy
        PORT: window.location.port,      // This will be the Vite port
        PROTOCOL: window.location.protocol.replace(':', ''),
        WS_PROTOCOL: window.location.protocol === 'https:' ? 'wss' : 'ws',
    },

    // Derive full URLs
    getBaseUrl: () => {
        return `${CONFIG.SERVER.PROTOCOL}://${CONFIG.SERVER.HOST}:${CONFIG.SERVER.PORT}`;
    },

    getWebSocketUrl: (userId: string) => {
        // Use relative path since we're proxying
        return `${CONFIG.SERVER.WS_PROTOCOL}://${CONFIG.SERVER.HOST}:${CONFIG.SERVER.PORT}/ws/${userId}`;
    },

    // API endpoints
    API: {
        // Use relative paths since we're proxying
        getStatus: (userId: string) => `/status/${userId}`,
        getMessages: (userId: string) => `/messages/${userId}`,
        deleteMessages: (userId: string, contactId: string) =>
            `/messages/${userId}/${contactId}`,
    }
};