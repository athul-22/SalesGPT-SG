#!/bin/bash
source .env.creds
mkdir -p creds
echo $GOOGLE_CREDENTIALS_BASE64 | base64 -d > creds/magiq-ai-fc9670291bfe.json
chmod 600 creds/magiq-ai-fc9670291bfe.json
echo "Credentials file created at: creds/magiq-ai-fc9670291bfe.json"
