# 1 Million Checkboxes - Konoha Edition 🍥

A real-time, highly scalable web application where 1 million checkboxes can be toggled by users synchronously across multiple browser instances. 

Inspired by "1 Million Checkboxes" and themed around Naruto's Hidden Leaf Village, this project demonstrates real-time communication, highly efficient state management, and custom rate limiting.

## 🚀 Features Implemented

- **1 Million Checkbox Grid**: Rendered performantly using HTML5 Canvas to avoid DOM crashes.
- **Real-Time Sync**: WebSockets (Socket.io) broadcast checkbox toggles to all users instantly.
- **OIDC Authentication**: Integrates with the custom Hidden Leaf OIDC Server. Only registered Ninjas can toggle boxes (guests are read-only).
- **Efficient State Storage**: Checkbox states are stored in Redis using a **Bitfield**. 1,000,000 checkboxes consume only ~125 KB of memory!
- **Scalable Pub/Sub**: Redis Pub/Sub is used so that updates can be broadcast across multiple horizontally scaled Node.js server instances.
- **Custom Rate Limiting**: Built entirely from scratch using Redis (no external `express-rate-limit` packages). Prevents API abuse and WebSocket spam clicking.

## 🛠 Tech Stack

- **Frontend**: HTML5 Canvas, Vanilla JS, CSS (No frameworks!)
- **Backend**: Node.js, Express, Socket.io
- **Database / Cache**: Redis (ioredis) for Bitfields, Pub/Sub, and Rate Limiting
- **Auth**: Custom OIDC integration using PKCE & JWT session cookies (jose)

## ⚙️ How to Run Locally

### Prerequisites
1. Ensure you have **Node.js** (v18+) and **Redis** running locally.
2. The **Hidden Leaf OIDC Server** must be running on `http://localhost:3000`.

### Setup Instructions

1. Clone the repository and navigate into the folder.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy the environment variables template:
   ```bash
   cp .env.example .env
   ```
4. **Register the App**: Go to the OIDC Server Dashboard (`http://localhost:3001/dashboard`). Register an app with the redirect URI: `http://localhost:9000/auth/callback`. Copy the Client ID and paste it into `.env`.
5. Start the development server:
   ```bash
   npm run dev
   ```
6. Open your browser to `http://localhost:9000`.

## 🔒 Auth Flow Explanation

The app uses an **Authorization Code Flow with PKCE** executed entirely on the backend to keep it secure:
1. When a user clicks "Login with Konoha", they hit `/auth/login`. The server generates a PKCE verifier, saves it in a short-lived secure cookie, and redirects the user to the OIDC Identity Server.
2. After authentication, the OIDC server redirects the user back to `/auth/callback` with a `code`.
3. The backend exchanges the `code` + `verifier` for an `id_token` from the OIDC server.
4. The backend reads the user profile from the token, generates its own signed Session JWT, and stores it in an `HttpOnly` cookie.
5. The Socket.io connection automatically picks up this cookie, allowing seamless authenticated real-time interactions!

## ⚡ WebSocket & Redis Flow Explanation

1. **Initial Load**: When a user connects, the server performs a `GET` on the Redis key `checkboxes:state` and sends the entire 125KB binary buffer to the client as Base64.
2. **Toggling**: When an authenticated user clicks a checkbox, they emit `client:toggle` with the `index`.
3. **Database Update**: The server updates the specific bit in Redis using `SETBIT checkboxes:state <index> 1/0`. This is an O(1) operation.
4. **Pub/Sub Broadcast**: The server publishes a message to the `checkboxes:updates` Redis channel.
5. **Real-time Sync**: Every server instance subscribed to the channel receives the message and uses `io.emit('server:toggle')` to update all connected clients in real time.

## 🛡️ Rate Limiting Logic Explanation

Rate limiting is built custom using Redis sliding/fixed window counters:
- **HTTP Limiter**: When a user hits `/auth/login`, we increment a Redis key `rate-limit:http:<IP>:<WindowTimestamp>`. If it exceeds 20 requests per minute, we block them. The key expires after 1 minute.
- **WebSocket Spam Protection**: When a user emits `client:toggle`, we increment `rate-limit:ws:<User_ID>:<WindowTimestamp>`. We limit users to 20 clicks per 10 seconds. This stops users from writing malicious scripts that spam the Socket.io server.

---
*Built with Chakra and Node.js for the 1 Million Checkboxes Challenge.*
