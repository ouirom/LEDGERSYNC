import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface SocketContextType {
  socket: Socket | null;
  connected: boolean;
  subscribeJob: (jobId: string) => void;
  unsubscribeJob: (jobId: string) => void;
}

const SocketContext = createContext<SocketContextType | null>(null);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Store socket in state (not ref) so components re-render when it's ready
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('accessToken')) return;

    const s = io('/', {
      path: '/socket.io',
      // Callback form: ré-évalué à chaque (re)connexion, pour toujours envoyer
      // l'access token courant (celui-ci tourne toutes les 15 min via le refresh
      // axios) plutôt qu'un token figé au montage qui expirerait sur une longue session.
      auth: (cb) => cb({ token: localStorage.getItem('accessToken') }),
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    s.on('connect', () => {
      setConnected(true);
      setSocket(s); // Make socket available to consumers AFTER connection
    });

    s.on('disconnect', () => setConnected(false));
    s.on('connect_error', (err) => {
      console.warn('[Socket.IO] Connection error:', err.message);
      setConnected(false);
    });

    // Set socket immediately even before connect so subscribeJob can work
    setSocket(s);

    return () => {
      s.disconnect();
      setSocket(null);
      setConnected(false);
    };
  }, []);

  const subscribeJob = (jobId: string) => socket?.emit('job:subscribe', jobId);
  const unsubscribeJob = (jobId: string) => socket?.emit('job:unsubscribe', jobId);

  return (
    <SocketContext.Provider value={{ socket, connected, subscribeJob, unsubscribeJob }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket must be used within SocketProvider');
  return ctx;
};
