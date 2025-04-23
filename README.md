# SalesGPT-SG

<div align="center">

![SalesGPT Logo](https://img.shields.io/badge/SalesGPT-AI%20Sales%20Assistant-blue?style=for-the-badge)

[![Node.js](https://img.shields.io/badge/Node.js-16+-green.svg)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://www.docker.com/)
[![GCP](https://img.shields.io/badge/GCP-Deployment-yellow.svg)](https://cloud.google.com/)
[![API](https://img.shields.io/badge/API-RESTful-orange.svg)](https://developer.mozilla.org/en-US/docs/Glossary/REST)

</div>

SalesGPT-SG is an AI-powered sales assistant backend that provides document management, sales strategies, and LinkedIn profile search capabilities to enhance sales team productivity and effectiveness.

## 📋 Table of Contents

1. [🚀 Project Overview](#-project-overview)
2. [🔧 Prerequisites](#-prerequisites)
3. [💻 Installation](#-installation)
   - [Node.js Backend](#nodejs-backend)
   - [Python Components](#python-components)
4. [🏃‍♂️ Running Locally](#️-running-locally)
5. [🐳 Docker Setup](#-docker-setup)
   - [Production Environment](#production-environment)
   - [Test Environment](#test-environment)
   - [Environment Variables](#environment-variables)
6. [☁️ GCP Deployment](#️-gcp-deployment)
   - [Manual Deployment](#manual-deployment)
   - [Using Deployment Scripts](#using-deployment-scripts)
   - [Setting up CI/CD](#setting-up-cicd-optional)
7. [🔌 API Documentation](#-api-documentation)
8. [🛠️ Troubleshooting](#️-troubleshooting)

## 🚀 Project Overview

SalesGPT-SG combines document management with AI-powered tools to assist in sales processes. Key features include:

- **Document Management**: Upload, process, and query sales documents
- **AI-Powered Strategies**: Generate customized sales strategies for different companies
- **LinkedIn Integration**: Search and analyze professional profiles
- **Google Drive Integration**: Access and process documents from Google Drive
- **Sales Co-Pilot**: Real-time AI assistant for sales conversations

## 🔧 Prerequisites

Before you begin, ensure you have the following installed and set up:

- **Node.js** (v16.x or later) - [Download](https://nodejs.org/)
- **Python** 3.9+ (for Streamlit frontend) - [Download](https://www.python.org/downloads/)
- **Docker** and Docker Compose (for containerized deployment) - [Download](https://www.docker.com/products/docker-desktop/)
- **Google Cloud SDK** (for GCP deployment) - [Download](https://cloud.google.com/sdk/docs/install)

You'll also need accounts and API keys for:
- OpenAI API
- Google Cloud Platform
- ChromaDB
- Exa.ai (for enhanced search capabilities)

## 💻 Installation

### Node.js Backend

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd SalesGPT-SG
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create environment file:
   ```bash
   cp .env.template .env
   ```

4. Add your API keys and configuration settings to the `.env` file:
   ```
   API_KEY=your-api-key
   OPENAI_API_KEY=your-openai-key
   GOOGLE_APPLICATION_CREDENTIALS=path/to/credentials.json
   CHROMA_API_TOKEN=your-chroma-token
   EXA_API_KEY=your-exa-api-key
   ```

### Python Components

If you need to run the Streamlit front-end:

1. Create and activate a virtual environment:
   ```bash
   python -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   ```

2. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

## 🏃‍♂️ Running Locally

### Start the Node.js backend:

```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

### Start the Streamlit app (if needed):

```bash
streamlit run app.py
```

The backend API will be available at http://localhost:3000/api
The Streamlit interface will be available at http://localhost:8501

## 🐳 Docker Setup

### Production Environment

1. Create the necessary directories if they don't exist:
   ```bash
   mkdir -p data/uploads logs creds
   ```

2. Place your Google Cloud credentials in `./creds/magiq-ai-fc9670291bfe.json` or set up environment variables as described in the [Environment Variables](#environment-variables) section.

3. Build and run the production container:
   ```bash
   docker-compose -f docker-compose.prod.yml build
   docker-compose -f docker-compose.prod.yml up -d
   ```

4. Access the API at: http://localhost:3000/api

### Test Environment

1. Create the necessary directories if they don't exist:
   ```bash
   mkdir -p data/uploads logs creds
   ```

2. Build and run the test container:
   ```bash
   docker-compose -f docker-compose.test.yml build
   docker-compose -f docker-compose.test.yml up -d
   ```

3. Access the test API at: http://localhost:3001/api

### Environment Variables

For Docker deployment, you need to set up environment variables in `.env.prod` or `.env.test` files:

| Variable | Description | Required |
|----------|-------------|----------|
| `API_KEY` | Authentication key for API requests | Yes |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to Google credentials file | Yes |
| `GCS_BUCKET_NAME` | Google Cloud Storage bucket name | Yes |
| `CHROMA_API_TOKEN` | ChromaDB authentication token | Yes |
| `CHROMA_TENANT` | ChromaDB tenant | Yes |
| `CHROMA_DATABASE` | ChromaDB database name | Yes |
| `EXA_API_KEY` | EXA API key | Yes |
| `OPENAI_API_KEY` | OpenAI API key | Yes |

For Cloud Run deployment, you can convert Google credentials to base64:
```bash
cat ./creds/magiq-ai-fc9670291bfe.json | base64 > credentials-base64.txt
```
Then add the content to `GOOGLE_CREDENTIALS_BASE64` environment variable in your deployment files.

## ☁️ GCP Deployment

### Manual Deployment

1. Setup GCP Project
   - Create or select a GCP project
   - Enable required APIs:
     - Cloud Run
     - Container Registry
     - Cloud Build
     - Cloud Storage

2. Set environment variables:
   ```bash
   export PROJECT_ID=your-gcp-project-id
   export REGION=asia-southeast1  # or your preferred region
   ```

3. Configure Docker to use gcloud:
   ```bash
   gcloud auth configure-docker
   ```

4. Build and push the production image:
   ```bash
   docker build -t gcr.io/$PROJECT_ID/salesgpt-backend:prod .
   docker push gcr.io/$PROJECT_ID/salesgpt-backend:prod
   ```

5. Deploy to Cloud Run:
   ```bash
   gcloud run deploy salesgpt-prod \
     --image gcr.io/$PROJECT_ID/salesgpt-backend:prod \
     --platform managed \
     --region $REGION \
     --allow-unauthenticated \
     --env-vars-file .env.prod.yaml \
     --memory 512Mi
   ```

6. Get the deployed URL from the command output.

### Using Deployment Scripts

The project includes deployment scripts for both production and test environments:

1. Set up credentials file:
   ```bash
   # Create a file to store base64-encoded credentials
   echo "GOOGLE_CREDENTIALS_BASE64=\"$(cat ./creds/magiq-ai-fc9670291bfe.json | base64)\"" > .env.creds
   ```

2. Deploy to production:
   ```bash
   chmod +x deploy-prod.sh
   ./deploy-prod.sh
   ```

3. Deploy to test environment:
   ```bash
   chmod +x deploy-test.sh
   ./deploy-test.sh
   ```

The scripts will automatically:
- Build the Docker image
- Push it to Google Container Registry
- Deploy to Cloud Run with proper environment variables
- Output the service URL when done

### Setting up CI/CD (Optional)

Configure Cloud Build for continuous deployment from your repository:

1. Connect your GitHub/GitLab repository to Cloud Build
2. Create a Cloud Build trigger for the main branch
3. Add a cloudbuild.yaml file to your repository:
   ```yaml
   steps:
   - name: 'gcr.io/cloud-builders/docker'
     args: ['build', '-t', 'gcr.io/$PROJECT_ID/salesgpt-backend:$COMMIT_SHA', '.']
   - name: 'gcr.io/cloud-builders/docker'
     args: ['push', 'gcr.io/$PROJECT_ID/salesgpt-backend:$COMMIT_SHA']
   - name: 'gcr.io/cloud-builders/gcloud'
     args:
     - 'run'
     - 'deploy'
     - 'salesgpt-prod'
     - '--image'
     - 'gcr.io/$PROJECT_ID/salesgpt-backend:$COMMIT_SHA'
     - '--platform'
     - 'managed'
     - '--region'
     - 'asia-southeast1'
     - '--allow-unauthenticated'
     - '--env-vars-file'
     - '.env.prod.yaml'
   ```

## 🔌 API Documentation

All API endpoints are available under the `/api` base path. You can import the [Postman collection](link-to-your-postman-collection) for easy testing.

### Authentication

All API endpoints require authentication using an API key passed in the header:

```
X-API-KEY: salesgpt-secure-key-xhsjdjwn2849wbfewdsknsk
```

### Sales Strategy Endpoints

#### Generate Sales Strategy

- **URL:** `/api/generateSalesStrategy`
- **Method:** `POST`
- **Body:**
  ```json
  {
    "companyName": "Example Corp",
    "industry": "Technology",
    "targetMarket": "Enterprise",
    "competitiveAdvantage": "AI-powered solutions"
  }
  ```

#### Generate Exa Sales Strategy

- **URL:** `/api/generateExaSalesStrategy`
- **Method:** `POST`
- **Body:** Same as above

### Sales Co-Pilot Endpoints

#### Get Sales Assistance

- **URL:** `/api/salesCoPilot`
- **Method:** `POST`
- **Body:**
  ```json
  {
    "message": "How should I approach this client?",
    "context": {
      "clientName": "Acme Corp",
      "industry": "Manufacturing"
    }
  }
  ```

#### Clear Conversation History

- **URL:** `/api/salesCoPilot/clearHistory`
- **Method:** `POST`
- **Body:** `{}`

### Document Management Endpoints

#### Upload Document

- **URL:** `/api/documents/upload`
- **Method:** `POST`
- **Body:** `multipart/form-data` with a file field named `document`

#### Query Documents

- **URL:** `/api/documents/query`
- **Method:** `POST`
- **Body:**
  ```json
  {
    "query": "sales strategy for enterprise clients",
    "limit": 5
  }
  ```

#### List Documents

- **URL:** `/api/documents/list`
- **Method:** `GET`

#### Get Queue Stats

- **URL:** `/api/documents/queue-stats`
- **Method:** `GET`

### Google Drive Integration Endpoints

#### List Drive Files

- **URL:** `/api/drive/list`
- **Method:** `GET`

#### Process Drive File

- **URL:** `/api/drive/process/:fileId`
- **Method:** `POST`
- **Body:** `{}`

### LinkedIn Profile Endpoints

#### Search LinkedIn Profiles

- **URL:** `/api/linkedinProfiles/search`
- **Method:** `POST`
- **Body:**
  ```json
  {
    "company": "Microsoft",
    "position": "Software Engineer",
    "location": "Seattle",
    "limit": 5,
    "expertise": "AI",
    "team": "Research"
  }
  ```

### System Status

- **URL:** `/api/system/status`
- **Method:** `GET`

## 🛠️ Troubleshooting

### Common Issues

#### Authentication Errors
- Ensure the API key is correctly set in your headers
- Check that environment variables are properly loaded

#### Document Processing Issues
- Verify ChromaDB connection is working
- Check the document queue status using the `/api/documents/queue-stats` endpoint

#### GCP Deployment Issues
- Ensure Google Cloud SDK is properly configured
- Check if all required APIs are enabled
- Verify service account permissions

### Logs

Docker logs can be accessed using:
```bash
docker logs <container-id>
```

For Cloud Run services, check logs in the Google Cloud Console or use:
```bash
gcloud beta run services logs tail salesgpt-prod --region <your-region>
```

### Support

For additional support, please [open an issue](link-to-your-issue-tracker) in the repository.

## Environment Variables Setup

Create a `.env` file in the root directory with the following variables:

```env
# API Keys
RAPID_API_KEY=your_rapid_api_key
RAPID_API_HOST=apollo-io-no-cookies-required.p.rapidapi.com
OPENAI_API_KEY=your_openai_api_key

# Google Cloud Configuration
GOOGLE_APPLICATION_CREDENTIALS=./creds/your-credentials-file.json
GOOGLE_CLOUD_PROJECT_ID=your_project_id
GOOGLE_LOCATION=your_gcp_region
GCS_BUCKET_NAME=your_gcs_bucket_name

# Gemini API
GEMINI_API_KEY=your_gemini_api_key

# Server settings
PORT=3000

# ChromaDB
CHROMA_API_TOKEN=your_chroma_api_token
CHROMA_TENANT=your_chroma_tenant
CHROMA_DATABASE=KnowledgeBase

# Exa.ai
EXA_API_KEY=your_exa_api_key

# BackendAPI Configuration
ORGANIZATION_API_URL=your_organization_api_url
ORGANIZATION_API_TOKEN=your_organization_api_token

# Google Drive API credentials
GOOGLE_API_KEY=your_google_api_key

# Middleware 
API_KEY=your_api_key_for_authentication
```

## Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Create the `.env` file with required environment variables
4. Start the development server: `npm run dev`

## Features

- AI-powered sales strategy generation
- Sales co-pilot conversational assistant
- Document management and knowledge base
- Google Drive integration
- LinkedIn profile analysis

## Deployment

### Production Deployment

```bash
# Build and deploy to Google Cloud Run
./deploy-prod.sh
```

### Test Deployment

```bash
# Build and deploy test environment
./deploy-test.sh
```

## Folder Structure

- `/controllers` - API controllers
- `/routes` - API route definitions
- `/services` - Service layer for business logic
- `/middleware` - Express middleware
- `/utils` - Utility functions
- `/config` - Configuration files

## API Documentation

The API supports the following main endpoints:

- `/api/salesCoPilot` - Conversational sales assistant
- `/api/generateSalesStrategy` - Sales strategy generation
- `/api/documents/*` - Document management
- `/api/drive/*` - Google Drive integration

For detailed API documentation, see the API docs.