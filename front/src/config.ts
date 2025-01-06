// config.ts
export const CONFIG = {
    // Server configuration
    SERVER: {
        // Use localhost for initial testing
        HOST: 'localhost',
        PORT: '3000',
        PROTOCOL: 'http',
        WS_PROTOCOL: 'ws',
    },

    // Derive full URLs
    getBaseUrl: () => {
        return `${CONFIG.SERVER.PROTOCOL}://${CONFIG.SERVER.HOST}:${CONFIG.SERVER.PORT}`;
    },

    getWebSocketUrl: (userId: string) => {
        const wsUrl = `${CONFIG.SERVER.WS_PROTOCOL}://${CONFIG.SERVER.HOST}:${CONFIG.SERVER.PORT}/ws/${userId}`;
        console.log('Generated WebSocket URL:', wsUrl);
        return wsUrl;
    },

    // API endpoints
    API: {
        getStatus: (userId: string) => `${CONFIG.getBaseUrl()}/status/${userId}`,
        getMessages: (userId: string) => `${CONFIG.getBaseUrl()}/messages/${userId}`,
        deleteMessages: (userId: string, contactId: string) =>
            `${CONFIG.getBaseUrl()}/messages/${userId}/${contactId}`,
    }
};