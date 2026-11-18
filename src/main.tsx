import { render } from 'preact';
import './index.css';
import { App } from './App';

const rootEl = document.getElementById('app');
if (rootEl) {
  render(<App />, rootEl);
}
