// storage.ts
export interface StoredUser {
    id: string;
    lastActive: string;
}

export interface StorageManager {
    messages: {[key: string]: Message[]};  // key is 'fromId:toId'
    users: StoredUser[];
}

const STORAGE_KEY = 'chat_storage';

export const generateShortId = (): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 4; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

export const getStorageManager = (): StorageManager => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
        return JSON.parse(stored);
    }
    return { messages: {}, users: [] };
};

export const saveToStorage = (manager: StorageManager) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(manager));
};

export const saveMessage = (message: Message) => {
    const storage = getStorageManager();
    const key = `${message.fromId}:${message.toId}`;
    const reverseKey = `${message.toId}:${message.fromId}`;

    if (!storage.messages[key]) {
        storage.messages[key] = [];
    }
    storage.messages[key].push(message);

    // Save reverse reference for easier retrieval
    if (!storage.messages[reverseKey]) {
        storage.messages[reverseKey] = [];
    }
    storage.messages[reverseKey].push(message);

    saveToStorage(storage);
};

export const getMessages = (userId1: string, userId2: string): Message[] => {
    const storage = getStorageManager();
    const key = `${userId1}:${userId2}`;
    const messages = storage.messages[key] || [];
    return messages.sort((a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
};

export const saveUser = (userId: string) => {
    const storage = getStorageManager();
    const existingUser = storage.users.find(u => u.id === userId);

    if (!existingUser) {
        storage.users.push({
            id: userId,
            lastActive: new Date().toISOString()
        });
    } else {
        existingUser.lastActive = new Date().toISOString();
    }

    saveToStorage(storage);
};

export const getRecentUsers = (): StoredUser[] => {
    const storage = getStorageManager();
    return storage.users
        .sort((a, b) => new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime())
        .slice(0, 5);  // Keep only 5 most recent users
};