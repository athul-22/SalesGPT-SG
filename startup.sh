#!/bin/bash

if [ ! -z "$GOOGLE_CREDENTIALS_BASE64" ]; then
  echo "Creating credentials file from environment variable..."
  echo $GOOGLE_CREDENTIALS_BASE64 | base64 -d > /app/creds/magiq-ai-fc9670291bfe.json
  chmod 600 /app/creds/magiq-ai-fc9670291bfe.json
  echo "Credentials file created at: /app/creds/magiq-ai-fc9670291bfe.json"
fi

# Print environment variables for debugging (excluding sensitive ones)
echo "GOOGLE_APPLICATION_CREDENTIALS=${GOOGLE_APPLICATION_CREDENTIALS}"
echo "NODE_ENV=${NODE_ENV}"
echo "API_KEY is set: $(if [ -z \"$API_KEY\" ]; then echo 'NO'; else echo 'YES'; fi)"

# Start the server
exec node server.js
