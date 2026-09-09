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
  const dialogStatus = root.querySelector('[data-auth-dialog-status]');
  const loginDialog = root.querySelector('#auth-sign-in-dialog');
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
  let feedbackInteractive = false;
  let savedFeedback = { ratings: [], comment: '' };

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
    for (const target of [status, dialogStatus]) {
      if (!target) continue;
      target.textContent = message;
      target.hidden = message === '';
    }
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

  function showSignInPrompt(target, action) {
    if (!target) return;
    const button = document.createElement('button');
    button.className = 'inline-sign-in-link';
    button.type = 'button';
    button.textContent = 'Sign in';
    button.setAttribute('popovertarget', 'auth-sign-in-dialog');
    target.replaceChildren(button, ` ${action}`);
  }

  function showQuizSignInPrompt() {
    showSignInPrompt(quizSaveStatus, 'to save your answer.');
  }

  function showFeedbackSignInPrompt() {
    showSignInPrompt(feedbackStatus, 'to rate this quiz.');
  }

  function readFeedback() {
    return {
      ratings: feedbackRatings
        .filter((rating) => rating.checked)
        .map((rating) => rating.value)
        .sort(),
      comment: feedbackComment?.value.trim() ?? '',
    };
  }

  function feedbackHasContent({ ratings, comment }) {
    return ratings.length > 0 || comment.length > 0;
  }

  function feedbackMatchesSaved({ ratings, comment }) {
    return comment === savedFeedback.comment
      && ratings.length === savedFeedback.ratings.length
      && ratings.every((rating, index) => rating === savedFeedback.ratings[index]);
  }

  function updateFeedbackSubmit() {
    if (!feedbackSubmit) return;
    const currentFeedback = readFeedback();
    feedbackSubmit.disabled = !feedbackInteractive
      || !feedbackHasContent(currentFeedback)
      || feedbackMatchesSaved(currentFeedback);
  }

  function setSavedFeedback(feedbackValue) {
    savedFeedback = {
      ratings: [...feedbackValue.ratings].sort(),
      comment: feedbackValue.comment.trim(),
    };
    updateFeedbackSubmit();
  }

  function setFeedbackEnabled(enabled) {
    feedbackInteractive = enabled;
    if (feedbackComment) feedbackComment.disabled = !enabled;
    for (const rating of feedbackRatings) rating.disabled = !enabled;
    updateFeedbackSubmit();
  }

  function clearFeedback() {
    for (const rating of feedbackRatings) rating.checked = false;
    if (feedbackComment) feedbackComment.value = '';
    setSavedFeedback({ ratings: [], comment: '' });
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
      loginDialog?.hidePopover?.();
      showStatus('');
    } catch (error) {
      showStatus(friendlyError(error));
    } finally {
      setBusy(false);
    }
  }

  async function saveQuizAnswer({ quizId, answer }) {
    if (!currentUser) {
      showQuizSignInPrompt();
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
      if (currentUser?.uid !== user.uid) return;

      const restoredFeedback = {
        ratings: snapshot.exists() ? snapshot.data().ratings ?? [] : [],
        comment: snapshot.exists() ? snapshot.data().comment ?? '' : '',
      };
      const selected = new Set(restoredFeedback.ratings);
      for (const rating of feedbackRatings) rating.checked = selected.has(rating.value);
      if (feedbackComment) feedbackComment.value = restoredFeedback.comment;
      setSavedFeedback(restoredFeedback);
      showFeedbackStatus(snapshot.exists() ? 'Your feedback is saved. You can update it.' : 'Select labels and/or leave a concise comment.');
      setFeedbackEnabled(true);
    } catch (error) {
      if (currentUser?.uid !== user.uid) return;
      const errorCode = error?.code ? ` (${error.code})` : '';
      showFeedbackStatus(`Could not load feedback${errorCode}.`);
    }
  }

  async function saveFeedback() {
    if (!currentUser || !feedback) return;
    const user = currentUser;
    const currentFeedback = readFeedback();
    const { ratings, comment } = currentFeedback;
    if (!feedbackHasContent(currentFeedback)) {
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
      await setDoc(feedbackReference(user), {
        ratings,
        comment,
        updatedAt: serverTimestamp(),
      });
      if (currentUser?.uid !== user.uid) return;
      setSavedFeedback(currentFeedback);
      showFeedbackStatus('Feedback saved. Thank you!');
    } catch (error) {
      if (currentUser?.uid !== user.uid) return;
      const errorCode = error?.code ? ` (${error.code})` : '';
      showFeedbackStatus(`Could not save feedback${errorCode}.`);
    } finally {
      if (currentUser?.uid === user.uid) setFeedbackEnabled(true);
    }
  }

  for (const button of authButtons) {
    button.addEventListener('click', () => signIn(button.dataset.authProvider));
  }
  document.addEventListener('quiz-answer-selected', (event) => saveQuizAnswer(event.detail));
  feedbackSubmit?.addEventListener('click', saveFeedback);
  for (const rating of feedbackRatings) {
    rating.addEventListener('change', updateFeedbackSubmit);
  }
  feedbackComment?.addEventListener('input', updateFeedbackSubmit);

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
      showQuizSignInPrompt();
      showExplanationLink(false);
      setFeedbackEnabled(false);
      clearFeedback();
      showFeedbackSignInPrompt();
      return;
    }

    loginDialog?.hidePopover?.();
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
