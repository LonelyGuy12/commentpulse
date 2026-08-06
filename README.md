# 🛡️ CommentPulse

CommentPulse is a real-time AI-powered YouTube live chat moderation dashboard. It continuously monitors your active YouTube live streams, uses advanced NLP to detect threats and abusive language, and allows you to instantly ban offending users directly from the web interface.

## 🌟 Features
* **Real-time Monitoring:** Connects to the YouTube Data API to stream live chat messages instantly.
* **AI Threat Detection:** Uses a local Python/FastAPI ML engine to score messages and identify abusive language, threats, and impersonators.
* **One-Click Banning:** Fully integrated Google OAuth 2.0 flow allows channel owners to ban users and delete offending messages instantly from the dashboard.
* **Beautiful Dashboard:** Built with React and Vite for a fast, responsive, and sleek moderation experience.

---

## 🏗️ Architecture

CommentPulse is broken down into three distinct services:

1. **Dashboard (`/dashboard`)**
   - The React (Vite) frontend application.
   - Provides the visual interface for the streamer/moderator.
2. **Orchestrator (`/orchestrator`)**
   - The Node.js (Express) backend.
   - Handles the YouTube Data API polling, Google OAuth flow, and communicates with the Threat Engine.
3. **Threat Engine (`/threat-engine`)**
   - The Python (FastAPI) machine learning service.
   - Analyzes incoming text and returns a risk score and flagged categories.

---

## 🚀 Getting Started

### Prerequisites
* **Node.js** (v18+)
* **Python** (3.9+)
* **Google Cloud Project** with the **YouTube Data API v3** enabled.
* **OAuth 2.0 Client Credentials** (Web Application type).

### 1. Configure the Orchestrator
Navigate to the orchestrator directory and install dependencies:
```bash
cd orchestrator
npm install
```

Create a `.env` file in the `orchestrator/` directory and add your Google Cloud credentials and API key:
```env
YOUTUBE_API_KEY=your_youtube_data_api_key_here
PORT=3001
THREAT_ENGINE_URL=http://localhost:8000

# OAuth2 credentials for real live chat banning
GOOGLE_CLIENT_ID=your_oauth_client_id_here
GOOGLE_CLIENT_SECRET=your_oauth_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:5173
```

### 2. Start the Threat Engine
Navigate to the threat engine directory, create a virtual environment, and install requirements:
```bash
cd threat-engine
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Run the FastAPI server:
```bash
uvicorn main:app --reload --port 8000
```

### 3. Start the Orchestrator
In a new terminal window, start the Node.js backend:
```bash
cd orchestrator
npm start
```

### 4. Start the Dashboard
In another terminal window, start the React frontend:
```bash
cd dashboard
npm install
npm run dev
```

---

## 🎮 How to Use

1. Open your browser to `http://localhost:5173`.
2. Click **Login with YouTube** in the top right corner and authenticate with the Google account that owns your YouTube channel.
3. Paste a YouTube Live Stream URL (or Video ID) into the input box and click **Monitor Live Chat**.
4. The dashboard will begin listening for messages. Any message flagged by the Threat Engine will appear as a card.
5. Click **Ban User & Hide** to permanently ban the user from your live stream and delete their message via the YouTube API.

---

## ⚠️ Notes on Testing
* **Ghost Banning:** When you ban a user via the YouTube API, YouTube "ghost bans" them. They will still be able to type and see their own messages locally, but **no one else** (including the streamer and other viewers) will see their messages. To verify a ban worked, check the chat from a third-party account!
* **Owner Immunity:** You cannot use CommentPulse to ban the channel owner or moderators of a stream. Banning these privileged users will silently fail or be ignored by YouTube. Test the ban functionality using a standard viewer alt-account.
