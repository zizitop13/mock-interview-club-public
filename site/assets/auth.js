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

const MAX_FEEDBACK_COMMENT_LENGTH = 1000;
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
  const explanationLink = document.querySelector('[data-explanation-link]');
  const feedback = document.querySelector('[data-quiz-feedback][data-quiz-id]');
  const feedbackSubmit = feedback?.querySelector('[data-feedback-submit]');
  const feedbackStatus = feedback?.querySelector('[data-feedback-status]');
  const feedbackRatings = [...(feedback?.querySelectorAll('[data-feedback-rating]') ?? [])];
  const feedbackComment = feedback?.querySelector('[data-feedback-comment]');
  let currentUser = null;

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

  function showExplanationLink(show) {
    if (explanationLink) explanationLink.hidden = !show;
  }

  function showFeedbackStatus(message) {
    if (feedbackStatus) feedbackStatus.textContent = message;
  }

  function setFeedbackEnabled(enabled) {
    if (feedbackSubmit) feedbackSubmit.disabled = !enabled;
    if (feedbackComment) feedbackComment.disabled = !enabled;
    for (const rating of feedbackRatings) rating.disabled = !enabled;
  }

  function allowQuizRetry(quizId) {
    document.dispatchEvent(new CustomEvent('quiz-answer-save-failed', { detail: { quizId } }));
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

  async function saveQuizAnswer({ quizId, answer }) {
    if (!currentUser) {
      showQuizSaveStatus('Sign in to save this answer.');
      showExplanationLink(false);
      allowQuizRetry(quizId);
      return;
    }

    showQuizSaveStatus('Saving answer…');
    try {
      await setDoc(doc(database, 'users', currentUser.uid, 'quizAnswers', quizId), {
        selectedAnswer: answer,
        updatedAt: serverTimestamp(),
      });
      showQuizSaveStatus('Answer saved. Your choice is now locked.');
      showExplanationLink(true);
    } catch (error) {
      const errorCode = error?.code ? ` (${error.code})` : '';
      showQuizSaveStatus(`Could not save the answer${errorCode}.`);
      showExplanationLink(false);
      const restored = error?.code === 'permission-denied' ? await restoreQuizAnswer(currentUser) : false;
      if (!restored) allowQuizRetry(quizId);
    }
  }

  async function restoreQuizAnswer(user) {
    if (!quizAnswers) return false;
    showQuizSaveStatus('Loading your saved answer…');
    const quizId = quizAnswers.dataset.quizId;
    try {
      const snapshot = await getDoc(doc(database, 'users', user.uid, 'quizAnswers', quizId));
      if (!snapshot.exists()) {
        showQuizSaveStatus('Your answer will be saved automatically.');
        showExplanationLink(false);
        return false;
      }

      document.dispatchEvent(new CustomEvent('quiz-answer-loaded', {
        detail: { quizId, answer: snapshot.data().selectedAnswer },
      }));
      showQuizSaveStatus('Saved answer restored. Your choice is locked.');
      showExplanationLink(true);
      return true;
    } catch (error) {
      const errorCode = error?.code ? ` (${error.code})` : '';
      showQuizSaveStatus(`Could not load the saved answer${errorCode}.`);
      showExplanationLink(false);
      return false;
    }
  }

  function feedbackReference(user) {
    return doc(database, 'quizFeedback', feedback.dataset.quizId, 'votes', user.uid);
  }

  async function restoreFeedback(user) {
    if (!feedback) return;
    setFeedbackEnabled(false);
    showFeedbackStatus('Loading your feedback…');
    try {
      const snapshot = await getDoc(feedbackReference(user));
      const selected = new Set(snapshot.exists() ? snapshot.data().ratings : []);
      for (const rating of feedbackRatings) rating.checked = selected.has(rating.value);
      if (feedbackComment) feedbackComment.value = snapshot.exists() ? snapshot.data().comment ?? '' : '';
      showFeedbackStatus(snapshot.exists() ? 'Your feedback is saved. You can update it.' : 'Select labels and/or leave a concise comment.');
      setFeedbackEnabled(true);
    } catch (error) {
      const errorCode = error?.code ? ` (${error.code})` : '';
      showFeedbackStatus(`Could not load feedback${errorCode}.`);
    }
  }

  async function saveFeedback() {
    if (!currentUser || !feedback) return;
    const ratings = feedbackRatings.filter((rating) => rating.checked).map((rating) => rating.value);
    const comment = feedbackComment?.value.trim() ?? '';
    if (ratings.length === 0 && comment.length === 0) {
      showFeedbackStatus('Select at least one label or write a comment.');
      return;
    }
    if (comment.length > MAX_FEEDBACK_COMMENT_LENGTH) {
      showFeedbackStatus('Keep the comment within 1,000 characters.');
      return;
    }

    setFeedbackEnabled(false);
    showFeedbackStatus('Saving feedback…');
    try {
      await setDoc(feedbackReference(currentUser), {
        ratings,
        comment,
        updatedAt: serverTimestamp(),
      });
      showFeedbackStatus('Feedback saved. Thank you!');
    } catch (error) {
      const errorCode = error?.code ? ` (${error.code})` : '';
      showFeedbackStatus(`Could not save feedback${errorCode}.`);
    } finally {
      setFeedbackEnabled(Boolean(currentUser));
    }
  }

  for (const button of authButtons) {
    button.addEventListener('click', () => signIn(button.dataset.authProvider));
  }
  document.addEventListener('quiz-answer-selected', (event) => saveQuizAnswer(event.detail));
  feedbackSubmit?.addEventListener('click', saveFeedback);

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
    currentUser = user;
    signedOutView.hidden = Boolean(user);
    signedInView.hidden = !user;

    if (!user) {
      showQuizSaveStatus('Sign in to save your answer.');
      showExplanationLink(false);
      setFeedbackEnabled(false);
      showFeedbackStatus('Sign in to rate this quiz.');
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
    restoreFeedback(user);
  });
}
