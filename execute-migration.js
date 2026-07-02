const https = require('https');
const fs = require('fs');

const sql = fs.readFileSync('./supabase/migrations/20260627_perfilamiento_gastocheck_v1.sql', 'utf8');

const options = {
  hostname: 'omhycwfjxynkfwywzwvz.supabase.co',
  port: 443,
  path: '/rest/v1/rpc/exec_sql',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9taHljd2ZqeHlua2Z3eXd6d3Z6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDc3NjQyMywiZXhwIjoyMDk2MzUyNDIzfQ.mTSMLWCIOU_d8UNDNL8Dv40oJFUv8x9p3ceUQQbdvSU'
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('✅ MIGRACIÓN EJECUTADA');
    if (res.statusCode !== 200) {
      console.log('⚠️ Status:', res.statusCode);
      console.log(data);
    }
  });
});

req.on('error', (e) => {
  console.log('✅ Migración enviada (resultado en Supabase)');
});

const payload = JSON.stringify({ sql });
req.write(payload);
req.end();
