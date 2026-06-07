import os
import json
import urllib.request
import urllib.parse
from dotenv import dotenv_values

# Load env variables
env_vars = dotenv_values('/home/ubuntu/HamaFX-Ai/.env.local')

TOKEN = "vca_6wnipl5N79g54J7Yd8ETWyxK1FmEv0QxyHMuRkZFUyY2EF2UC12IWFwG"
PROJECT = "hamafx-ai"

# Fetch existing variables to avoid duplicates
req = urllib.request.Request(f"https://api.vercel.com/v9/projects/{PROJECT}/env")
req.add_header("Authorization", f"Bearer {TOKEN}")
response = urllib.request.urlopen(req)
existing_envs = json.loads(response.read())['envs']
existing_keys = [e['key'] for e in existing_envs]

added_keys = []

for key, value in env_vars.items():
    if not key or not value or key == "VERCEL_OIDC_TOKEN" or key in existing_keys:
        continue
    
    payload = json.dumps({
        "key": key,
        "value": value,
        "type": "encrypted",
        "target": ["production", "preview", "development"]
    }).encode('utf-8')
    
    req = urllib.request.Request(f"https://api.vercel.com/v10/projects/{PROJECT}/env", data=payload, method='POST')
    req.add_header("Authorization", f"Bearer {TOKEN}")
    req.add_header("Content-Type", "application/json")
    
    try:
        urllib.request.urlopen(req)
        added_keys.append(key)
    except urllib.error.HTTPError as e:
        print(f"Failed to add {key}: {e.read().decode('utf-8')}")

print(f"Successfully added: {added_keys}")
