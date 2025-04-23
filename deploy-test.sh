set -e 

export PROJECT_ID=magiq-ai
export REGION=asia-southeast1

source .env.creds

echo "--- Building test image ---"
gcloud builds submit \
  --tag gcr.io/$PROJECT_ID/salesgpt-backend:test .

echo "--- Deploying to Cloud Run ---"
sed -i '' '/PORT:/d' .env.test.yaml

gcloud run deploy salesgpt-test \
  --image gcr.io/$PROJECT_ID/salesgpt-backend:test \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --env-vars-file .env.test.yaml \
  --set-env-vars="GOOGLE_CREDENTIALS_BASE64=${GOOGLE_CREDENTIALS_BASE64}" \
  --memory 512Mi

echo "--- Getting service URL ---"
TEST_URL=$(gcloud run services describe salesgpt-test --region $REGION --format="value(status.url)")
echo "Test API is available at: $TEST_URL"