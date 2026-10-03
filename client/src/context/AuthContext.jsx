import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authClient } from '../api/axios';
import Loader from '../components/Loader';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(authClient.getSession);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  useEffect(() => {
    let active = true;
    const unsubscribe = authClient.subscribe((next, expired) => {
      setSession(next);
      if (expired) navigateRef.current('/login', { replace: true });
    });
    authClient.refresh().catch(() => {}).finally(() => { if (active) setLoading(false); });
    return () => { active = false; unsubscribe(); };
  }, []);
  return <AuthContext.Provider value={{ ...session, loading, login: authClient.login, logout: authClient.logout }}>{loading ? <Loader /> : children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
