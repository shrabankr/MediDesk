import { MediDeskBridge } from '../preload/index.js';

declare global {
  interface Window {
    mediDeskBridge?: MediDeskBridge;
  }
}

export {};
