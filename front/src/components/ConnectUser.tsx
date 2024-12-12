import React, { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../hooks/redux';
import { setConnectedUser } from '../store/messageSlice';
import styles from './ConnectUser.module.css';
import {getRecentContacts, saveRecentContact} from "../store/storage.ts";

export const ConnectUser = () => {
    const [targetUserId, setTargetUserId] = useState('');
    const currentUserId = useAppSelector(state => state.messages.currentUserId);
    const dispatch = useAppDispatch();
    const recentContacts = currentUserId ? getRecentContacts(currentUserId) : [];

    const handleConnect = async (userId: string) => {
        if (userId.trim() && userId !== currentUserId) {
            try {
                const response = await fetch(`http://localhost:3000/status/${userId}`);
                const data = await response.json();

                // Save to recent contacts
                if (currentUserId) {
                    saveRecentContact(currentUserId, userId);
                }

                dispatch(setConnectedUser(userId));
            } catch (error) {
                console.error('Error checking user status:', error);
            }
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        handleConnect(targetUserId);
    };

    return (
        <div className={styles.container}>
            <h2 className={styles.title}>Connect to User</h2>
            <div className={styles.userInfo}>
                Your ID: <span className={styles.userId}>{currentUserId}</span>
            </div>

            

            <form onSubmit={handleSubmit} className={styles.form}>
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