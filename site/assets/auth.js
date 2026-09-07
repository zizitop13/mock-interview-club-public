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
import {
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
  setDoc,
} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyAvpOopA-ySiMq78WT7N-G2B8h8YlBZVnc',
  authDomain: 'mock-interview-club.firebaseapp.com',
  projectId: 'mock-interview-club',
  storageBucket: 'mock-interview-club.firebasestorage.app',
  messagingSenderId: '995203978364',
  appId: '1:995203978364:web:7ec9a89b645148b09ce5f9',
};

const LOG_PREFIX = '[Mock Interview Club][Firebase]';

function logInfo(message, details = {}) {
  console.info(LOG_PREFIX, message, details);
}

function logError(operation, error, context = {}) {
  console.error(LOG_PREFIX, operation, {
    ...context,
    code: error?.code ?? 'unknown',
    message: error?.message ?? String(error),
    stack: error?.stack,
  }, error);
}

const root = document.querySelector('[data-auth-root]');

if (root) {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const database = getFirestore(app);
  const signedOutView = root.querySelector('[data-auth-signed-out]');
  const signedInView = root.querySelector('[data-auth-signed-in]');
  const name = root.querySelector('[data-auth-name]');
  const email = root.querySelector('[data-auth-email]');
  const avatar = root.querySelector('[data-auth-avatar]');
  const status = root.querySelector('[data-auth-status]');
  const authButtons = [...root.querySelectorAll('[data-auth-provider]')];
  const signOutButton = root.querySelector('[data-auth-sign-out]');
  const quizAnswers = document.querySelector('.quiz-answers[data-quiz-id]');
  const quizSaveStatus = document.querySelector('[data-quiz-save-status]');
  let currentUser = null;

  logInfo('Firebase initialized', {
    projectId: firebaseConfig.projectId,
    authDomain: firebaseConfig.authDomain,
    page: window.location.href,
    quizId: quizAnswers?.dataset.quizId ?? null,
  });

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

  function showQuizSaveStatus(message) {
    if (quizSaveStatus) quizSaveStatus.textContent = message;
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
    logInfo('Starting sign-in', { provider: providerName });

    try {
      const result = await signInWithPopup(auth, provider);
      logInfo('Sign-in completed', { provider: providerName, uid: result.user.uid });
      showStatus('');
    } catch (error) {
      logError('Sign-in failed', error, { provider: providerName });
      showStatus(friendlyError(error));
    } finally {
      setBusy(false);
    }
  }

  async function saveQuizAnswer({ quizId, answer }) {
    if (!currentUser) {
      showQuizSaveStatus('Sign in to save this answer.');
      return;
    }

    showQuizSaveStatus('Saving answer…');
    const documentPath = `users/${currentUser.uid}/quizAnswers/${quizId}`;
    logInfo('Saving quiz answer', { documentPath, quizId, answer });

    try {
      await setDoc(doc(database, 'users', currentUser.uid, 'quizAnswers', quizId), {
        selectedAnswer: answer,
        updatedAt: serverTimestamp(),
      });
      logInfo('Quiz answer saved', { documentPath, quizId, answer });
      showQuizSaveStatus('Answer saved.');
    } catch (error) {
      logError('Quiz answer save failed', error, { documentPath, quizId, answer });
      const errorCode = error?.code ? ` (${error.code})` : '';
      showQuizSaveStatus(`Could not save the answer${errorCode}. Check the browser console.`);
    }
  }

  async function restoreQuizAnswer(user) {
    if (!quizAnswers) return;

    showQuizSaveStatus('Loading your saved answer…');
    const quizId = quizAnswers.dataset.quizId;
    const documentPath = `users/${user.uid}/quizAnswers/${quizId}`;
    logInfo('Loading saved quiz answer', { documentPath, quizId });

    try {
      const snapshot = await getDoc(doc(
        database,
        'users',
        user.uid,
        'quizAnswers',
        quizId,
      ));

      if (!snapshot.exists()) {
        logInfo('No saved quiz answer found', { documentPath, quizId });
        showQuizSaveStatus('Your answer will be saved automatically.');
        return;
      }

      document.dispatchEvent(new CustomEvent('quiz-answer-loaded', {
        detail: {
          quizId,
          answer: snapshot.data().selectedAnswer,
        },
      }));
      logInfo('Saved quiz answer restored', {
        documentPath,
        quizId,
        answer: snapshot.data().selectedAnswer,
      });
      showQuizSaveStatus('Saved answer restored.');
    } catch (error) {
      logError('Saved quiz answer load failed', error, { documentPath, quizId });
      const errorCode = error?.code ? ` (${error.code})` : '';
      showQuizSaveStatus(`Could not load the saved answer${errorCode}. Check the browser console.`);
    }
  }

  for (const button of authButtons) {
    button.addEventListener('click', () => signIn(button.dataset.authProvider));
  }

  document.addEventListener('quiz-answer-selected', (event) => {
    logInfo('Quiz answer event received', event.detail);
    saveQuizAnswer(event.detail);
  });

  signOutButton?.addEventListener('click', async () => {
    setBusy(true);
    showStatus('Signing out…');

    try {
      await signOut(auth);
      logInfo('Sign-out completed');
      showStatus('');
    } catch (error) {
      logError('Sign-out failed', error);
      showStatus('Could not sign out. Please try again.');
    } finally {
      setBusy(false);
    }
  });

  setPersistence(auth, browserLocalPersistence)
    .then(() => logInfo('Local authentication persistence enabled'))
    .catch((error) => {
      logError('Authentication persistence setup failed', error);
      showStatus('Your browser may not remember the login after this page closes.');
    });

  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    logInfo('Authentication state changed', {
      authenticated: Boolean(user),
      uid: user?.uid ?? null,
      providers: user?.providerData.map(({ providerId }) => providerId) ?? [],
    });
    signedOutView.hidden = Boolean(user);
    signedInView.hidden = !user;

    if (!user) {
      showQuizSaveStatus('Sign in to save your answer.');
      return;
    }

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

    restoreQuizAnswer(user);
  });
}
