/**
 * Authentication and profile management shared by both applications.
 *
 * Firebase Auth holds credentials; the `users` collection holds the role and
 * profile. The two are always read together, because a signed-in user with no
 * profile document has no role and must not be treated as staff.
 */

import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { AccountType, Role } from './constants';
import { COLLECTIONS, auth, db, getAdminWorkerAuth } from './firebase';
import { fullNameOf, type UserProfile } from './types';

export interface RegisterBuyerInput {
  email: string;
  password: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  mobile?: string;
  address?: string;
  birthDate?: string;
}

/** Fetches the Firestore profile for a signed-in user, or null if absent. */
export async function fetchProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, COLLECTIONS.USERS, uid));
  if (!snap.exists()) return null;
  return { uid, ...snap.data() } as UserProfile;
}

/**
 * Registers a buyer on the Web Portal.
 *
 * The role is pinned to `buyer` and the account type to `initial` here and in
 * the security rules, so self-registration can never mint a staff account.
 * The account is upgraded to `client` only when staff approve a reservation.
 */
export async function registerBuyer(
  input: RegisterBuyerInput,
): Promise<UserProfile> {
  const credential = await createUserWithEmailAndPassword(
    auth,
    input.email.trim(),
    input.password,
  );

  const displayName = fullNameOf(input);
  await updateProfile(credential.user, { displayName });

  const profile = {
    role: Role.BUYER,
    accountType: AccountType.INITIAL,
    firstName: input.firstName.trim(),
    middleName: input.middleName?.trim() ?? '',
    lastName: input.lastName.trim(),
    email: input.email.trim(),
    mobile: input.mobile ?? '',
    address: input.address ?? '',
    birthDate: input.birthDate ?? '',
    active: true,
    createdAt: serverTimestamp(),
  };

  await setDoc(doc(db, COLLECTIONS.USERS, credential.user.uid), profile);

  return { uid: credential.user.uid, ...profile } as unknown as UserProfile;
}

/** Signs a user in and returns their profile alongside the credential. */
export async function signIn(
  email: string,
  password: string,
): Promise<{ user: User; profile: UserProfile | null }> {
  const credential = await signInWithEmailAndPassword(
    auth,
    email.trim(),
    password,
  );
  const profile = await fetchProfile(credential.user.uid);
  return { user: credential.user, profile };
}

export const signOutUser = (): Promise<void> => signOut(auth);

/**
 * Subscribes to auth changes, resolving the Firestore profile each time.
 *
 * Emits **twice** for a signed-in user: once the moment the session is known,
 * and again when the profile document arrives.
 *
 * The previous single-emit version awaited Firestore before reporting
 * anything, so every reload hid the whole account area through two sequential
 * round trips — session restore, then a profile read. Auth alone is enough to
 * know someone is signed in, and `user.displayName` carries their name in the
 * token, so the UI can render immediately and refine afterwards.
 */
export interface AuthSnapshot {
  user: User | null;
  profile: UserProfile | null;
  /**
   * True between the two emits.
   *
   * Callers must not read a null `profile` as "this account has no profile
   * document" while this is set — the Internal app refuses access on exactly
   * that condition, and would flash "Access denied" at every staff member on
   * every reload.
   */
  profileLoading: boolean;
}

export function watchAuth(callback: (state: AuthSnapshot) => void): () => void {
  // Guards against a slow profile read landing after the user has signed out
  // or switched accounts, which would restore a stale identity.
  let generation = 0;

  return onAuthStateChanged(auth, (user) => {
    const current = ++generation;

    if (!user) {
      callback({ user: null, profile: null, profileLoading: false });
      return;
    }

    callback({ user, profile: null, profileLoading: true });

    void fetchProfile(user.uid)
      .then((profile) => {
        if (current === generation) {
          callback({ user, profile, profileLoading: false });
        }
      })
      .catch(() => {
        // The session is still valid, so the app stays signed in on
        // token-only details rather than appearing logged out.
        if (current === generation) {
          callback({ user, profile: null, profileLoading: false });
        }
      });
  });
}

export interface CreateStaffInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: Exclude<Role, 'buyer'>;
  department?: string;
}

/**
 * Creates a staff account from the Internal Management System.
 *
 * Runs against a secondary Firebase app so the new user is signed in on that
 * throwaway instance instead of replacing the admin's own session — otherwise
 * an admin would be logged out and logged back in as the employee they just
 * created. The alternative, the Admin SDK, needs Cloud Functions and therefore
 * a paid plan.
 */
export async function createStaffAccount(
  input: CreateStaffInput,
): Promise<string> {
  const workerAuth = getAdminWorkerAuth();

  const credential = await createUserWithEmailAndPassword(
    workerAuth,
    input.email.trim(),
    input.password,
  );

  await setDoc(doc(db, COLLECTIONS.USERS, credential.user.uid), {
    role: input.role,
    accountType: AccountType.INITIAL,
    firstName: input.firstName.trim(),
    middleName: '',
    lastName: input.lastName.trim(),
    email: input.email.trim(),
    department: input.department ?? '',
    active: true,
    createdAt: serverTimestamp(),
  });

  // Leave the secondary instance signed out so it is clean for the next call.
  await signOut(workerAuth);

  return credential.user.uid;
}

/** Updates the editable parts of a user's own profile. */
export async function updateOwnProfile(
  uid: string,
  changes: Partial<
    Pick<
      UserProfile,
      'firstName' | 'middleName' | 'lastName' | 'mobile' | 'address' | 'birthDate'
    >
  >,
): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.USERS, uid), changes);
}

/** Turns Firebase's error codes into messages a user can act on. */
export function authErrorMessage(error: unknown): string {
  const code = (error as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/invalid-email':
      return 'That email address is not valid.';
    case 'auth/email-already-in-use':
      return 'An account already exists with that email address.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Incorrect email or password.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.';
    default:
      return (error as Error)?.message ?? 'Something went wrong. Please try again.';
  }
}
