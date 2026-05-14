const express = require('express');
const fetch = require('node-fetch');
const app = express();

const CLIENT_ID = process.env.QBO_CLIENT_ID;
const CLIENT_SECRET = process.env.QBO_CLIENT_SECRET;
let refreshToken = process.env.QBO_REFRESH_TOKEN;

app.get('/token', async (req, res) => {
  try {
    const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
    const response = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: `grant_type=refresh_token&refresh_token=${refreshToken}`
    });
    const data = await response.json();
    if (data.access_token) {
      refreshToken = data.refresh_token;
      res.json({ access_token: data.access_token });
    } else {
      res.status(500).json({ error: 'Token refresh failed', details: data });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(process.env.PORT || 3000);
