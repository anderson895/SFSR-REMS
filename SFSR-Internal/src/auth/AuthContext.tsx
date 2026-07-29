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
  loading: boolean;
  /**
   * True while the profile document is still in flight.
   *
   * `RequireStaff` refuses access to an account with no profile, so it must be
   * able to tell "not fetched yet" from "has none" — otherwise every staff
   * member sees Access denied for a moment on each reload.
   */
  profileLoading: boolean;
}

const AuthContext = createContext<AuthState>({
  user: null,
  profile: null,
  loading: true,
  profileLoading: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    loading: true,
    profileLoading: false,
  });

  useEffect(
    () =>
      watchAuth(({ user, profile, profileLoading }) =>
        setState({ user, profile, loading: false, profileLoading }),
      ),
    [],
  );

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
