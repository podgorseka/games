
'use client';

// Stub file to avoid breaking existing imports while removing Firebase functionality.
export function initializeFirebase() {
  return { firebaseApp: null, firestore: null, auth: null };
}

export function FirebaseClientProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export const useUser = () => ({ user: null, loading: false });
export const useAuth = () => null;
export const useFirestore = () => null;
