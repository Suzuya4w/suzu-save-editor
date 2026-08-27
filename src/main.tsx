// @ts-nocheck
import { render } from 'solid-js/web';
import App from './App';
import './App.css';

const root = document.getElementById('root');

if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
  throw new Error(
    'Root element not found. Did you forget to add it to your index.html? Or maybe the id attribute got misspelled?',
  );
}

root!.innerHTML = '';
render(() => <App />, root!);

const loader = document.getElementById('initial-loader');

if (loader) {
  requestAnimationFrame(() => {
    setTimeout(() => {
      loader.classList.add('fade-out');
      setTimeout(() => {
        loader.remove();
      }, 700);
    }, 200); 
  });
}