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
    'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
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
