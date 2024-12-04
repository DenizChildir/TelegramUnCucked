import React, { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../hooks/redux';
import { setConnectedUser } from '../store/messageSlice';

export const ConnectUser = () => {
    const [targetUserId, setTargetUserId] = useState('');
    const currentUserId = useAppSelector(state => state.messages.currentUserId);
    const dispatch = useAppDispatch();

    const handleConnect = async (e: React.FormEvent) => {
        e.preventDefault();
        if (targetUserId.trim() && targetUserId !== currentUserId) {
            try {
                // Check if user exists/is available
                const response = await fetch(`http://localhost:3000/status/${targetUserId}`);
                const data = await response.json();

                // Connect even if user is offline - messages will be stored
                dispatch(setConnectedUser(targetUserId));
            } catch (error) {
                console.error('Error checking user status:', error);
            }
        }
    };

    return (
        <div>
            <h2>Connect to User</h2>
            <p>Your ID: {currentUserId}</p>
            <form onSubmit={handleConnect} style={{ marginTop: '20px' }}>
                <div>
                    <input
                        type="text"
                        value={targetUserId}
                        onChange={(e) => setTargetUserId(e.target.value)}
                        placeholder="Enter recipient's user ID"
                        style={{
                            padding: '8px',
                            marginRight: '10px',
                            width: '200px'
                        }}
                    />
                    <button
                        type="submit"
                        disabled={!targetUserId.trim() || targetUserId === currentUserId}
                        style={{
                            padding: '8px 16px'
                        }}
                    >
                        Connect
                    </button>
                </div>
            </form>
        </div>
    );
};