import { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

// Phase 0 scaffold: authentication and session restoration come next.
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const logout = () => setUser(null);
  return <AuthContext.Provider value={{ user, setUser, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
