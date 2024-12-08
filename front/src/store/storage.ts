// storage.ts
import { Message } from "../types/types";

export const saveMessage = (message: Message) => {
    const storage = getStorageManager();
    const key = `${message.fromId}:${message.toId}`;
    const reverseKey = `${message.toId}:${message.fromId}`;

    // Ensure message arrays exist
    if (!storage.messages[key]) {
        storage.messages[key] = [];
    }
    if (!storage.messages[reverseKey]) {
        storage.messages[reverseKey] = [];
    }

    // Check if message already exists in either array
    const messageExists = storage.messages[key].some(msg => msg.id === message.id) ||
        storage.messages[reverseKey].some(msg => msg.id === message.id);

    if (!messageExists) {
        storage.messages[key].push(message);
        // Only store in reverse key if it's a different conversation
        if (key !== reverseKey) {
            storage.messages[reverseKey].push(message);
        }
        saveToStorage(storage);
    }
};

export const getMessages = (userId1: string, userId2: string): Message[] => {
    const storage = getStorageManager();
    const key = `${userId1}:${userId2}`;

    // Get messages and ensure uniqueness by ID
    const messages = storage.messages[key] || [];
    const uniqueMessages = Array.from(
        messages.reduce((map, message) => {
            if (!map.has(message.id)) {
                map.set(message.id, message);
            }
            return map;
        }, new Map<string, Message>()).values()
    );

    return uniqueMessages.sort((a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
};

export const generateShortId = (): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    const timestamp = Date.now().toString(36); // Convert timestamp to base36

    // Add 4 random characters
    for (let i = 0; i < 4; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    // Combine timestamp and random string to ensure uniqueness
    return `${result}-${timestamp}`;
};

export interface StoredUser {
    id: string;
    lastActive: string;
}

export interface StorageManager {
    messages: {[key: string]: Message[]};  // key is 'fromId:toId'
    users: StoredUser[];
}

const STORAGE_KEY = 'chat_storage';


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
export const deleteUserData = (userId: string) => {
    const storage = getStorageManager();

    // Remove user from recent users
    storage.users = storage.users.filter(user => user.id !== userId);

    // Remove all messages where user is sender or receiver
    const newMessages: {[key: string]: Message[]} = {};
    Object.entries(storage.messages).forEach(([key, messages]) => {
        const [fromId, toId] = key.split(':');
        if (fromId !== userId && toId !== userId) {
            newMessages[key] = messages;
        }
    });

    storage.messages = newMessages;
    saveToStorage(storage);
};

export const deleteContactHistory = (userId: string, contactId: string) => {
    const storage = getStorageManager();

    // Remove messages between these users
    const newMessages: {[key: string]: Message[]} = {};
    Object.entries(storage.messages).forEach(([key, messages]) => {
        const [fromId, toId] = key.split(':');
        if ((fromId !== userId || toId !== contactId) &&
            (fromId !== contactId || toId !== userId)) {
            newMessages[key] = messages;
        }
    });

    storage.messages = newMessages;
    saveToStorage(storage);
};

export const deleteAllUserData = () => {
    localStorage.removeItem(STORAGE_KEY);
};