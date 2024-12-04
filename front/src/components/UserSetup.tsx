import React, { useState } from 'react';
import { useAppDispatch } from '../hooks/redux';
import { setCurrentUser } from '../store/messageSlice';
import { generateShortId, saveUser, getRecentUsers, StoredUser } from '../store/storage.ts';

export const UserSetup = () => {
    const [userId, setUserId] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const dispatch = useAppDispatch();
    const recentUsers = getRecentUsers();

    const generateNewId = () => {
        const newId = generateShortId();
        setUserId(newId);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (userId.trim()) {
            saveUser(userId);
            dispatch(setCurrentUser(userId));
        }
    };

    const selectUser = (user: StoredUser) => {
        saveUser(user.id);
        dispatch(setCurrentUser(user.id));
    };

    return (
        <div className="p-4">
            <h2 className="text-xl mb-4">Setup User ID</h2>

            {recentUsers.length > 0 && (
                <div className="mb-4">
                    <h3 className="text-lg mb-2">Recent Users</h3>
                    <div className="flex gap-2 flex-wrap">
                        {recentUsers.map(user => (
                            <button
                                key={user.id}
                                onClick={() => selectUser(user)}
                                className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
                            >
                                {user.id}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <form onSubmit={handleSubmit} className="flex gap-2">
                <input
                    type="text"
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    placeholder="Enter user ID"
                    className="px-3 py-2 border rounded"
                />
                <button
                    type="button"
                    onClick={generateNewId}
                    disabled={isLoading}
                    className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
                >
                    Generate ID
                </button>
                <button
                    type="submit"
                    disabled={!userId.trim()}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                    Connect
                </button>
            </form>
        </div>
    );
};