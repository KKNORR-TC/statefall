const status = document.getElementById('bootStatus');
const root = document.getElementById('gameRoot');
const retry = document.getElementById('bootRetry');
retry?.addEventListener('click', () => location.reload());

// The page stays visibly busy and non-interactive until artwork and handlers are ready.
import('./legacy-game.js').then(() => {
  root?.removeAttribute('inert');
  root?.removeAttribute('aria-busy');
  status?.remove();
}).catch(error => {
  console.error('[statefall] startup failed', error);
  status?.setAttribute('role', 'alert');
  const title = document.getElementById('bootTitle');
  const message = document.getElementById('bootMessage');
  if (title) title.textContent = 'Unable to load Statefall';
  if (message) message.textContent = 'Check your connection and try again.';
  if (retry) retry.hidden = false;
});
