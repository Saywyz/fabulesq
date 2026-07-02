// Bootstrap : câble l'UI hot-seat sur le moteur. Le réseau (net/) arrive en Phase 3.
import './ui/style.css';
import { mountApp } from './ui/app';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('#app introuvable');

// Hors de engine/ : Math.random / Date.now sont autorisés ici (génération du seed et du code).
const seed = Date.now() >>> 0;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans I/O/0/1 ambigus
const code = Array.from({ length: 6 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');

mountApp(app, { seed, code });
