# Snuggle Send Sync

Build a complete, production-minded real-time web chat application for the FIRST COMMIT hackathon at IIT Mandi.

Core requirements

User registration, login, logout, and protected sessions.

A searchable list of registered users.

Private one-to-one conversations.

Instant message delivery using Supabase Realtime or another suitable WebSocket-based solution.

Persistent messages with sender ID, conversation ID, and timestamps.

Conversation history that loads after login or page refresh.

Responsive design for desktop and mobile.

Proper loading states, empty states, validation, and error handling.

Design Create a polished, modern messaging experience with a distinctive visual identity, a conversation sidebar, message bubbles, user avatars, timestamps, and a clean message composer.

Backend and security Use Lovable Cloud or Supabase for authentication, database, and real-time features. Create the necessary database schema and secure Row Level Security policies. Only conversation participants may read or send messages in that conversation. Users must not be able to impersonate other senders or access private conversations they do not belong to. Never expose secret API keys in frontend code.

Development rules Build actual working functionality, not a static mockup. Connect every control to its intended action. Do not use hardcoded sample messages as the application's permanent data source. Test signup, login, logout, private messaging between two separate accounts, message persistence, authorization, and error cases.

First establish the backend and database correctly, then implement the frontend and connect it to real data. Explain any configuration or manual setup that remains. Finish with a working deployable application and instructions for testing it.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/08ca0dae-d677-515f-be84-250370e392ab).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
