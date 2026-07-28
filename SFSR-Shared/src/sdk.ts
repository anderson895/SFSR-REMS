/**
 * Re-export of the Firebase SDK pieces that maintenance scripts need.
 *
 * Only scripts should import this. It exists because of module identity: `db`
 * in ./firebase.ts is created by whichever copy of the Firebase SDK *this
 * package* resolves. A Node script at the repo root resolves its own copy from
 * the root node_modules, and passing `db` from one copy into `collection()`
 * from the other fails with:
 *
 *   Expected first argument to collection() to be a CollectionReference,
 *   a DocumentReference or FirebaseFirestore
 *
 * The browser builds avoid this through `resolve.dedupe` in the two Vite
 * configs. Node has no equivalent, so scripts take the SDK from here instead of
 * importing "firebase/..." themselves, guaranteeing a single instance.
 *
 * Named explicitly rather than `export *` because firebase/app, firebase/auth,
 * and firebase/firestore each export a `setLogLevel` and an `Unsubscribe`.
 */

export {
  createUserWithEmailAndPassword,
  deleteUser,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';

export {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
