// types.ts - Add these to your existing types
export interface Message {
    id: string;
    fromId: string;
    toId: string;
    content: string;
    timestamp: string;
    delivered: boolean;
    readStatus: boolean;
    status: 'sent' | 'delivered' | 'read';
}

export interface RecentContact {
    userId: string;
    lastInteraction: string;
}

// Add FileSystem API types
declare global {
    interface Window {
        showDirectoryPicker(options?: {
            mode?: 'read' | 'readwrite';
            startIn?: 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos';
        }): Promise<FileSystemDirectoryHandle>;
    }
}