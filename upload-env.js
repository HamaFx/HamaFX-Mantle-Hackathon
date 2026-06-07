const fs = require('fs');
const https = require('https');

const token = "vca_6wnipl5N79g54J7Yd8ETWyxK1FmEv0QxyHMuRkZFUyY2EF2UC12IWFwG";
const project = "hamafx-ai";

function parseEnv(content) {
  const env = {};
  content.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      let key = match[1].trim();
      let val = match[2].trim();
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.slice(1, -1).replace(/\\n/g, '\n');
      }
      env[key] = val;
    }
  });
  return env;
}

function request(url, options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`Status ${res.statusCode}: ${data}`));
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function main() {
  const content = fs.readFileSync('.env.local', 'utf-8');
  const envs = parseEnv(content);
  
  const existing = await request(`https://api.vercel.com/v9/projects/${project}/env`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const existingKeys = existing.envs.map(e => e.key);

  for (const [key, value] of Object.entries(envs)) {
    if (key === 'VERCEL_OIDC_TOKEN' || existingKeys.includes(key)) continue;
    
    console.log(`Adding ${key}...`);
    try {
      await request(`https://api.vercel.com/v10/projects/${project}/env`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }, JSON.stringify({
        key, value, type: "encrypted", target: ["production", "preview", "development"]
      }));
      console.log(`Success: ${key}`);
    } catch (e) {
      console.error(`Failed ${key}:`, e.message);
    }
  }
}

main().catch(console.error);
