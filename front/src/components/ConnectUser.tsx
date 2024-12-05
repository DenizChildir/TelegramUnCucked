import React, { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../hooks/redux';
import { setConnectedUser } from '../store/messageSlice';
import styles from './ConnectUser.module.css';

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
        <div className={styles.container}>
            <h2 className={styles.title}>Connect to User</h2>
            <div className={styles.userInfo}>
                Your ID: <span className={styles.userId}>{currentUserId}</span>
            </div>
            <form onSubmit={handleConnect} className={styles.form}>
                <div className={styles.inputGroup}>
                    <input
                        type="text"
                        value={targetUserId}
                        onChange={(e) => setTargetUserId(e.target.value)}
                        placeholder="Enter recipient's user ID"
                        className={styles.input}
                    />
                    <button
                        type="submit"
                        disabled={!targetUserId.trim() || targetUserId === currentUserId}
                        className={styles.connectButton}
                    >
                        Connect
                    </button>
                </div>
            </form>
        </div>
    );
};