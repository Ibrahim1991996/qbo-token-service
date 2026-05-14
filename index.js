const express = require('express');
const fetch = require('node-fetch');
const app = express();

let refreshToken = process.env.QBO_REFRESH_TOKEN;
const CLIENT_ID = process.env.QBO_CLIENT_ID;
const CLIENT_SECRET = process.env.QBO_CLIENT_SECRET;
const REALM_ID = process.env.QBO_REALM_ID;

async function getAccessToken() {
  const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  const response = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json'
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    }).toString()
  });
  const data = await response.json();
  if (data.access_token) {
    refreshToken = data.refresh_token;
    return data.access_token;
  }
  throw new Error(JSON.stringify(data));
}

app.get('/token', async (req, res) => {
  try {
    const token = await getAccessToken();
    res.json({ access_token: token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/data', async (req, res) => {
  try {
    const accessToken = await getAccessToken();
    
    const today = new Date();
    const month = today.getMonth() + 1;
    const year = today.getFullYear();
    const startFY = month < 4 ? year - 1 : year;
    
    const allRows = [];
    
    for (let fy = 2026; fy <= startFY; fy++) {
      const startDate = `${fy}-04-01`;
      const endDate = `${fy + 1}-03-31`;
      const fyName = `FY${fy + 1}`;
      
      const url = `https://quickbooks.api.intuit.com/v3/company/${REALM_ID}/reports/ProfitAndLossDetail?start_date=${startDate}&end_date=${endDate}&minorversion=65`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      });
      
      const apiData = await response.json();
      
      function extractRows(rows) {
        const result = [];
        for (const row of rows) {
          if (row.type === 'Data') {
            const cols = row.ColData || [];
            const getValue = (i) => (cols[i] && cols[i].value) ? cols[i].value.trim() : '';
            result.push({
              Date: getValue(0),
              TransactionType: getValue(1),
              Num: getValue(2),
              Name: getValue(3),
              Class: getValue(4),
              Memo: getValue(5),
              Split: getValue(6),
              Amount: parseFloat(getValue(7)) || 0,
              Balance: parseFloat(getValue(8)) || 0,
              AnneeFiscale: fyName
            });
          } else if (row.type === 'Section' && row.Rows && row.Rows.Row) {
            result.push(...extractRows(row.Rows.Row));
          }
        }
        return result;
      }
      
      if (apiData.Rows && apiData.Rows.Row) {
        allRows.push(...extractRows(apiData.Rows.Row));
      }
    }
    
    const filtered = allRows.filter(r => r.Class !== '');
    res.json(filtered);
    
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(process.env.PORT || 3000);
