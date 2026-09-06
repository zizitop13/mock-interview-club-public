import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import {
  GithubAuthProvider,
  GoogleAuthProvider,
  browserLocalPersistence,
  getAuth,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signOut,
} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';

const firebaseConfig = {
  apiKey: 'AIzaSyAvpOopA-ySiMq78WT7N-G2B8h8YlBZVnc',
  authDomain: 'mock-interview-club.firebaseapp.com',
  projectId: 'mock-interview-club',
  storageBucket: 'mock-interview-club.firebasestorage.app',
  messagingSenderId: '995203978364',
  appId: '1:995203978364:web:7ec9a89b645148b09ce5f9',
};

const root = document.querySelector('[data-auth-root]');

if (root) {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const signedOutView = root.querySelector('[data-auth-signed-out]');
  const signedInView = root.querySelector('[data-auth-signed-in]');
  const name = root.querySelector('[data-auth-name]');
  const email = root.querySelector('[data-auth-email]');
  const avatar = root.querySelector('[data-auth-avatar]');
  const status = root.querySelector('[data-auth-status]');
  const authButtons = [...root.querySelectorAll('[data-auth-provider]')];
  const signOutButton = root.querySelector('[data-auth-sign-out]');

  const providers = {
    google: new GoogleAuthProvider(),
    github: new GithubAuthProvider(),
  };

  providers.google.setCustomParameters({ prompt: 'select_account' });

  function setBusy(busy) {
    root.setAttribute('aria-busy', String(busy));
    for (const button of [...authButtons, signOutButton]) {
      if (button) button.disabled = busy;
    }
  }

  function showStatus(message = '') {
    status.textContent = message;
    status.hidden = message === '';
  }

  function friendlyError(error) {
    const messages = {
      'auth/account-exists-with-different-credential': 'This email already uses another sign-in provider. Sign in with that provider first.',
      'auth/network-request-failed': 'The sign-in request could not reach Firebase. Check your connection and try again.',
      'auth/operation-not-allowed': 'This sign-in provider is not enabled yet.',
      'auth/popup-blocked': 'Your browser blocked the sign-in window. Allow pop-ups and try again.',
      'auth/popup-closed-by-user': 'The sign-in window was closed before login finished.',
      'auth/unauthorized-domain': 'This site domain is not authorized in Firebase yet.',
    };

    return messages[error?.code] ?? 'Sign-in failed. Please try again.';
  }

  async function signIn(providerName) {
    const provider = providers[providerName];
    if (!provider) return;

    setBusy(true);
    showStatus('Opening secure sign-in…');

    try {
      await signInWithPopup(auth, provider);
      showStatus('');
    } catch (error) {
      showStatus(friendlyError(error));
    } finally {
      setBusy(false);
    }
  }

  for (const button of authButtons) {
    button.addEventListener('click', () => signIn(button.dataset.authProvider));
  }

  signOutButton?.addEventListener('click', async () => {
    setBusy(true);
    showStatus('Signing out…');

    try {
      await signOut(auth);
      showStatus('');
    } catch {
      showStatus('Could not sign out. Please try again.');
    } finally {
      setBusy(false);
    }
  });

  setPersistence(auth, browserLocalPersistence).catch(() => {
    showStatus('Your browser may not remember the login after this page closes.');
  });

  onAuthStateChanged(auth, (user) => {
    signedOutView.hidden = Boolean(user);
    signedInView.hidden = !user;

    if (!user) return;

    name.textContent = user.displayName || user.email || 'Signed in';
    email.textContent = user.email && user.email !== name.textContent ? user.email : '';
    email.hidden = email.textContent === '';

    if (user.photoURL) {
      avatar.src = user.photoURL;
      avatar.alt = `${name.textContent} profile picture`;
      avatar.hidden = false;
    } else {
      avatar.removeAttribute('src');
      avatar.hidden = true;
    }
  });
}
