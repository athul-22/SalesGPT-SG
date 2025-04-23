
set -e 

export PROJECT_ID=magiq-ai
export REGION=asia-southeast1

source .env.creds

echo "--- Building production image ---"
gcloud builds submit \
  --tag gcr.io/$PROJECT_ID/salesgpt-backend:prod .

echo "--- Deploying to Cloud Run ---"
sed -i '' '/PORT:/d' .env.prod.yaml

echo "GOOGLE_CREDENTIALS_BASE64: \"${GOOGLE_CREDENTIALS_BASE64}\"" >> .env.prod.yaml

gcloud run deploy salesgpt-prod \
  --image gcr.io/$PROJECT_ID/salesgpt-backend:prod \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --env-vars-file .env.prod.yaml \
  --memory 512Mi

# Remove the credentials line from .env.prod.yaml to keep it clean
sed -i '' '/GOOGLE_CREDENTIALS_BASE64:/d' .env.prod.yaml

echo "--- Getting service URL ---"
PROD_URL=$(gcloud run services describe salesgpt-prod --region $REGION --format="value(status.url)")
echo "Production API is available at: $PROD_URL"