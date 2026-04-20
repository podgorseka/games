
'use client';

import { ReactNode, useEffect, useState } from 'react';
import { initializeFirebase } from './index';
import { FirebaseProvider } from './provider';
import { FirebaseApp } from 'firebase/app';
import { Firestore } from 'firebase/firestore';
import { Auth } from 'firebase/auth';

export function FirebaseClientProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [instances, setInstances] = useState<{
    firebaseApp: FirebaseApp | null;
    firestore: Firestore | null;
    auth: Auth | null;
  }>({
    firebaseApp: null,
    firestore: null,
    auth: null,
  });

  useEffect(() => {
    const { firebaseApp, firestore, auth } = initializeFirebase();
    setInstances({ firebaseApp, firestore, auth });
  }, []);

  return (
    <FirebaseProvider
      firebaseApp={instances.firebaseApp}
      firestore={instances.firestore}
      auth={instances.auth}
    >
      {children}
    </FirebaseProvider>
  );
}
