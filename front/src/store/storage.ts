// storage.ts
import { Message } from "../types/types";

export const saveMessage = (message: Message) => {
    const storage = getStorageManager();
    const key = `${message.fromId}:${message.toId}`;

    // Initialize arrays if they don't exist
    if (!storage.messages[key]) {
        storage.messages[key] = [];
    }

    // Don't save delivery confirmation messages
    if (message.content === 'delivered') {
        return;
    }

    // Check if message already exists
    const messageExists = storage.messages[key].some(msg => msg.id === message.id);

    if (!messageExists) {
        // Add debugging timestamps
        const messageWithTimestamp = {
            ...message,
            savedAt: new Date().toISOString()
        };

        storage.messages[key].push(messageWithTimestamp);
        saveToStorage(storage);

        console.log('Saved message in storage:', {
            key,
            message: messageWithTimestamp,
            allStoredMessages: storage.messages
        });
    }
};
export const getMessages = (userId1: string, userId2: string): Message[] => {
    const storage = getStorageManager();
    const forwardKey = `${userId1}:${userId2}`;
    const reverseKey = `${userId2}:${userId1}`;

    console.log('Getting messages with keys:', { forwardKey, reverseKey });
    console.log('Current storage state:', storage.messages);

    // Get messages from both directions
    const forwardMessages = storage.messages[forwardKey] || [];
    const reverseMessages = storage.messages[reverseKey] || [];

    console.log('Found messages:', {
        forward: forwardMessages,
        reverse: reverseMessages
    });

    // Combine all messages
    const allMessages = [...forwardMessages, ...reverseMessages];

    // Remove duplicate messages based on ID
    const uniqueMessages = Array.from(
        allMessages.reduce((map, message) => {
            // Skip 'delivered' messages
            if (message.content !== 'delivered') {
                map.set(message.id, message);
            }
            return map;
        }, new Map<string, Message>()).values()
    );

    // Sort by timestamp
    const sortedMessages = uniqueMessages.sort((a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    console.log('Returning sorted messages:', sortedMessages);
    return sortedMessages;
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

export const debugStorage = () => {
    const storage = getStorageManager();
    console.log('Current storage state:', storage);
};

export const inspectStorage = () => {
    const storage = getStorageManager();
    console.log('Current Storage State:', {
        messages: storage.messages,
        messageKeys: Object.keys(storage.messages),
        users: storage.users
    });
};

// storage.ts - Add these new functions
export interface RecentContact {
    userId: string;
    lastInteraction: string;
}

export interface StorageManager {
    messages: {[key: string]: Message[]};
    users: StoredUser[];
    recentContacts: {[userId: string]: RecentContact[]};
}

// Add this to your existing getStorageManager function
export const getStorageManager = (): StorageManager => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
        try {
            const parsed = JSON.parse(stored);
            // Ensure recentContacts exists
            return {
                ...parsed,
                recentContacts: parsed.recentContacts || {}
            };
        } catch (e) {
            console.error('Error parsing storage:', e);
            return { messages: {}, users: [], recentContacts: {} };
        }
    }
    return { messages: {}, users: [], recentContacts: {} };
};
// New function to save recent contact
export const saveRecentContact = (currentUserId: string, contactId: string) => {
    const storage = getStorageManager();

    // Initialize recentContacts for current user if doesn't exist
    if (!storage.recentContacts[currentUserId]) {
        storage.recentContacts[currentUserId] = [];
    }

    // Remove existing entry if present
    storage.recentContacts[currentUserId] = storage.recentContacts[currentUserId]
        .filter(contact => contact.userId !== contactId);

    // Add new entry at the beginning
    storage.recentContacts[currentUserId].unshift({
        userId: contactId,
        lastInteraction: new Date().toISOString()
    });

    // Keep only last 5 contacts
    storage.recentContacts[currentUserId] =
        storage.recentContacts[currentUserId].slice(0, 5);

    saveToStorage(storage);
};

// New function to get recent contacts
export const getRecentContacts = (userId: string): RecentContact[] => {
    const storage = getStorageManager();
    return storage.recentContacts[userId] || [];
};
