import { type UserProfile, watchAuth } from '@sfsr/shared';
import type { User } from 'firebase/auth';
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react';

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  /** True until the first auth callback lands, so guards don't flash. */
  loading: boolean;
}

const AuthContext = createContext<AuthState>({
  user: null,
  profile: null,
  loading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    loading: true,
  });

  useEffect(
    () =>
      watchAuth(({ user, profile }) =>
        setState({ user, profile, loading: false }),
      ),
    [],
  );

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
