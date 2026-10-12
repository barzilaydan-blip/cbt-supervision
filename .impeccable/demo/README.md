# Demo preview

A build of the real app with Firebase replaced by in-memory synthetic data, so screens
can be inspected without logging in and without touching clinical data.
Development only: the production build (`vite.config.js`) never includes these files.

    npx vite build --config .impeccable/demo/vite.demo.config.js
