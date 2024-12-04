import React, { useState } from 'react';
import { useAppDispatch } from '../hooks/redux';
import { setCurrentUser } from '../store/messageSlice';
import { generateShortId, saveUser, getRecentUsers, StoredUser } from '../store/storage.ts';

export const UserSetup = () => {
    const [userId, setUserId] = useState('');
    const [selectedId, setSelectedId] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const dispatch = useAppDispatch();
    const recentUsers = getRecentUsers();

    const generateNewId = () => {
        const newId = generateShortId();
        setUserId(newId);
        setSelectedId(newId);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (userId.trim()) {
            saveUser(userId);
            dispatch(setCurrentUser(userId));
        }
    };

    const selectUser = (user: StoredUser) => {
        setUserId(user.id);
        setSelectedId(user.id);
    };

    return (
        <div style={{
            maxWidth: '400px',
            margin: '40px auto',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            backgroundColor: 'white'
        }}>
            <h2 style={{
                textAlign: 'center',
                marginBottom: '24px',
                color: '#333',
                fontSize: '24px'
            }}>Setup User ID</h2>

            {selectedId && (
                <div style={{
                    textAlign: 'center',
                    marginBottom: '20px',
                    padding: '10px',
                    backgroundColor: '#e9ecef',
                    borderRadius: '4px'
                }}>
                    <span style={{ color: '#666' }}>Selected ID: </span>
                    <span style={{ fontWeight: 'bold', color: '#007bff' }}>{selectedId}</span>
                </div>
            )}

            {recentUsers.length > 0 && (
                <div style={{
                    marginBottom: '24px'
                }}>
                    <h3 style={{
                        fontSize: '16px',
                        color: '#666',
                        marginBottom: '12px'
                    }}>Recent Users</h3>
                    <div style={{
                        display: 'flex',
                        gap: '8px',
                        flexWrap: 'wrap'
                    }}>
                        {recentUsers.map(user => (
                            <button
                                key={user.id}
                                onClick={() => selectUser(user)}
                                style={{
                                    padding: '8px 16px',
                                    backgroundColor: user.id === selectedId ? '#007bff' : '#e9ecef',
                                    color: user.id === selectedId ? 'white' : 'black',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                {user.id}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <form onSubmit={handleSubmit} style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
            }}>
                <input
                    type="text"
                    value={userId}
                    onChange={(e) => {
                        setUserId(e.target.value);
                        setSelectedId(e.target.value);
                    }}
                    placeholder="Enter user ID"
                    style={{
                        padding: '10px',
                        borderRadius: '4px',
                        border: '1px solid #ccc',
                        fontSize: '16px'
                    }}
                />
                <div style={{
                    display: 'flex',
                    gap: '8px'
                }}>
                    <button
                        type="button"
                        onClick={generateNewId}
                        disabled={isLoading}
                        style={{
                            flex: 1,
                            padding: '10px',
                            backgroundColor: '#e9ecef',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '16px'
                        }}
                    >
                        Generate ID
                    </button>
                    <button
                        type="submit"
                        disabled={!userId.trim()}
                        style={{
                            flex: 1,
                            padding: '10px',
                            backgroundColor: '#007bff',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '16px'
                        }}
                    >
                        Connect
                    </button>
                </div>
            </form>
        </div>
    );
};