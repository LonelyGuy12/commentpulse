import { google } from 'googleapis';

export const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI ?? 'http://localhost:5173'
);

// We store the tokens here for simplicity since there's only one user (the channel owner).
let storedTokens = null;

export function setTokens(tokens) {
  storedTokens = tokens;
  oauth2Client.setCredentials(tokens);
}

export function getTokens() {
  return storedTokens;
}

export function getAuthUrl() {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/youtube.force-ssl',
      'https://www.googleapis.com/auth/youtube'
    ],
  });
}
