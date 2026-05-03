# A Million Checkboxes (Naruto Edition)

A real-time, massively multiplayer web application where users can interact with a grid of one million checkboxes. Built from scratch to handle high concurrency, state synchronization, and custom authentication flows.

## Project Overview
This project implements the "1 Million Checkboxes" concept with a custom architecture. It utilizes WebSockets for real-time synchronization, Redis for compact state storage and cross-instance broadcasting, and a custom-built OIDC Identity Provider for authentication.

## Tech Stack
- **Frontend**: HTML5, Vanilla JavaScript, Canvas API
- **Backend**: Node.js, Express.js
- **Real-time**: Socket.io
- **Data Store & Message Broker**: Redis
- **Authentication**: Custom OIDC / OAuth 2.0 Server

## Features Implemented
- Virtualized Canvas Rendering for 1,000,000 checkboxes (highly performant).
- Real-time state broadcasting via WebSockets.
- Redis Pub/Sub architecture to support multiple backend instances.
- Custom Redis-backed Rate Limiter (IP/User/Socket based) without external rate-limit packages.
- Cross-domain Authentication flow via custom OIDC Provider.
- Spectator mode for unauthenticated users (read-only access).
- Mobile-friendly tap interactions.

## Architecture & Implementation Details

### Checkbox State Storage
The entire state of 1,000,000 checkboxes is stored efficiently using Redis `BITFIELD`. Instead of storing boolean arrays or JSON objects, the state is mapped to binary bits, reducing the memory footprint to approximately 125 KB. The backend reads this buffer and serves it via base64 encoding during the initial client connection.

### WebSocket Flow
1. **Connection**: Client connects to `socket.io`. The backend fetches the Redis bitfield and emits the initial state.
2. **Action**: User clicks a checkbox. Client emits `client:toggle` with the index and desired state.
3. **Verification**: Backend validates the user's JWT session, applies rate limiting, and flips the specific bit in Redis.
4. **Broadcast**: The backend publishes a message via Redis Pub/Sub. All subscribed server instances receive the update and broadcast `server:toggle` to connected clients.

### Custom Rate Limiting
Implemented manually using Redis without external packages like `express-rate-limit`. 
- **HTTP Limiting**: Uses an IP-based rolling window to restrict login attempts.
- **WebSocket Spam Protection**: Uses a rolling window mechanism based on user ID to prevent spam clicking. It tracks timestamps in a Redis List, applying limits dynamically (e.g., max 10 clicks per rolling window).

### Auth Flow Explanation (OIDC / OAuth 2.0)
Authentication is handled by an external, custom-built OpenID Connect provider.
1. The client opens a popup to initiate the OAuth flow.
2. The Authorization code is exchanged for an access token via a secure backend route.
3. The backend sets an `HttpOnly`, `Secure` session cookie.
4. The frontend performs an automatic page reload after a successful login to establish the WebSocket connection with the attached authenticated cookie.
5. Socket middleware verifies the JWT token before allowing toggle actions.

## Setup Instructions

### Prerequisites
- Node.js (v18+)
- Redis Server
- Configured OIDC Provider (Konoha OIDC Server)

### Environment Variables
Create a `.env` file in the root directory:
```env
PORT=3000
APP_URL=http://localhost:3000
REDIS_URL=redis://localhost:6379
SESSION_SECRET=your_secure_random_string
OIDC_ISSUER=http://localhost:3001
OIDC_CLIENT_ID=your_client_id
OIDC_CLIENT_SECRET=your_client_secret
```

### Redis Setup
If using Docker, run a local Redis instance:
```bash
docker run -d -p 6379:6379 --name redis redis:alpine
```
Ensure `REDIS_URL` matches your local or remote Redis instance.

### Running Locally
```bash
# Install dependencies
npm install

# Start the development server
npm run dev
```
Navigate to `http://localhost:3000` in your browser.

## Submission Links
- **GitHub Repository**: [[codebase]](https://github.com/GagansharmaGit/A-Million-Checkbox)
- **Live Deployment**: [[live link]](https://a-million-checkbox.onrender.com)
- **Demo Video (YouTube Unlisted)**: [[youtube]](https://youtu.be/UseVcfHcIho)
