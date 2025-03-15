import streamlit as st
import requests
import json
import pandas as pd
import os
from io import BytesIO
import altair as alt

# Set page config
st.set_page_config(
    page_title="SalesGPT API Client",
    page_icon="📊",
    layout="wide"
)

# Define the base URL for your API
BASE_URL = "http://localhost:3002/api"

# Function to make API calls
def api_call(endpoint, method="GET", data=None, files=None, timeout=60):
    url = f"{BASE_URL}/{endpoint}"
    
    try:
        if method == "GET":
            response = requests.get(url, timeout=timeout)
        elif method == "POST":
            if files:
                response = requests.post(url, data=data, files=files, timeout=timeout)
            else:
                response = requests.post(url, json=data, timeout=timeout)
        
        return response
    except requests.exceptions.ConnectionError:
        st.error(f"Connection Error: Cannot connect to {url}. Is the server running?")
        return None
    except requests.exceptions.Timeout:
        st.error(f"Timeout Error: The request to {url} timed out after {timeout} seconds.")
        return None
    except Exception as e:
        st.error(f"Error making API call: {str(e)}")
        return None

# Sidebar navigation
with st.sidebar:
    st.title("SalesGPT API Client")
    
    # Server configuration
    st.subheader("Server Configuration")
    port = st.selectbox("API Server Port", [3000, 3001, 3002, 3003], index=2)
    BASE_URL = f"http://localhost:{port}/api"
    st.write(f"Using API endpoint: {BASE_URL}")
    
    # Navigation
    st.subheader("Navigation")
    selected_api = st.radio(
        "Select API",
        ["Generate Sales Strategy", "Upload Document", "Query Documents", "Document Details", "Generate Document-Based Strategy"]
    )

# Main content area styling
st.markdown("""
<style>
    .result-container {
        background-color: #f0f2f6;
        border-radius: 10px;
        padding: 20px;
        margin: 10px 0px;
    }
    .strategy-section {
        background-color: #f0f8ff;
        border-left: 5px solid #4169e1;
        padding: 15px;
        margin: 10px 0px;
        border-radius: 5px;
    }
    .competitor-card {
        background-color: #ffffff;
        border: 1px solid #e6e9ef;
        padding: 15px;
        margin: 5px 0px;
        border-radius: 5px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    }
    .metric-card {
        background-color: #f8f9fa;
        border-radius: 5px;
        padding: 10px;
        text-align: center;
    }
    .metric-value {
        font-size: 24px;
        font-weight: bold;
    }
    .metric-label {
        font-size: 14px;
        color: #6c757d;
    }
    .success {
        color: green;
    }
    .error {
        color: red;
    }
    .warning {
        color: #ff9800;
        background-color: #fff3e0;
        padding: 10px;
        border-radius: 5px;
        margin-bottom: 20px;
        border-left: 5px solid #ff9800;
    }
</style>
""", unsafe_allow_html=True)

# Generate Sales Strategy API
if selected_api == "Generate Sales Strategy":
    st.title("Generate Sales Strategy")
    st.write("Generate a comprehensive sales strategy for a target company")
    
    # Input fields
    company_name = st.text_input("Company Name", "Google")
    
    # Advanced options
    with st.expander("Advanced Options"):
        timeout = st.slider("Request Timeout (seconds)", 30, 300, 120)
    
    # Button to generate strategy
    if st.button("Generate Sales Strategy"):
        with st.spinner("Generating sales strategy... This may take up to 60 seconds."):
            try:
                payload = {
                    "companyName": company_name
                }
                
                # Add more detailed timeout and error handling
                response = api_call("generateSalesStrategy", method="POST", data=payload, timeout=120)
                
                if response is None:
                    st.error("Server is not responding. Please check if the backend is running.")
                    st.info("Make sure your backend server is running on: " + BASE_URL)
                elif response.status_code == 200:
                    try:
                        result = response.json()
                        # Display the results as before
                        st.success("Sales strategy generated successfully!")
                        
                        # Company overview section
                        st.header(f"{result.get('companyName', 'Company')} Sales Strategy")
                        
                        # Company metrics in a nice row
                        col1, col2, col3 = st.columns(3)
                        with col1:
                            st.markdown('<div class="metric-card">', unsafe_allow_html=True)
                            st.markdown(f'<div class="metric-value">{result.get("industry", "N/A")}</div>', unsafe_allow_html=True)
                            st.markdown('<div class="metric-label">Industry</div>', unsafe_allow_html=True)
                            st.markdown('</div>', unsafe_allow_html=True)
                        
                        with col2:
                            st.markdown('<div class="metric-card">', unsafe_allow_html=True)
                            st.markdown(f'<div class="metric-value">{result.get("businessType", "N/A")}</div>', unsafe_allow_html=True)
                            st.markdown('<div class="metric-label">Business Type</div>', unsafe_allow_html=True)
                            st.markdown('</div>', unsafe_allow_html=True)
                        
                        with col3:
                            company_size = result.get('companySize', {})
                            st.markdown('<div class="metric-card">', unsafe_allow_html=True)
                            st.markdown(f'<div class="metric-value">{company_size.get("employeeCount", "N/A")} employees</div>', unsafe_allow_html=True)
                            st.markdown(f'<div class="metric-label">Revenue: {company_size.get("annualRevenue", "N/A")}</div>', unsafe_allow_html=True)
                            st.markdown('</div>', unsafe_allow_html=True)
                        
                        # Product/Service Details section
                        st.subheader("Products & Services")
                        product_services = result.get('productOrServiceDetails', [])
                        if product_services:
                            for item in product_services:
                                st.markdown(f"• {item}")
                        else:
                            st.write("No product/service information available")
                        
                        # Sales Strategy sections
                        sales_strategy = result.get('salesStrategy', {})
                        if sales_strategy:
                            # Current Situation
                            st.subheader("Current Situation")
                            current_situation = sales_strategy.get('currentSituation', {})
                            
                            st.markdown('<div class="strategy-section">', unsafe_allow_html=True)
                            st.markdown("#### Opportunities & Priorities")
                            st.write(current_situation.get('opportunitiesAndPriorities', 'Not available'))
                            
                            st.markdown("#### Existing Technology Solutions")
                            tech_solutions = current_situation.get('existingTechnologySolutions', [])
                            for tech in tech_solutions:
                                st.markdown(f"• {tech}")
                            
                            st.markdown("#### Pain Points & Market Pressures")
                            pain_points = current_situation.get('painPointsAndMarketPressures', [])
                            for point in pain_points:
                                st.markdown(f"• {point}")
                            st.markdown('</div>', unsafe_allow_html=True)
                            
                            # Value Proposition
                            st.subheader("Value Proposition")
                            value_prop = sales_strategy.get('valueProposition', {})
                            
                            st.markdown('<div class="strategy-section">', unsafe_allow_html=True)
                            st.markdown("#### Key Message")
                            st.write(value_prop.get('keyMessage', 'Not available'))
                            
                            st.markdown("#### Benefits")
                            benefits = value_prop.get('benefits', [])
                            for benefit in benefits:
                                st.markdown(f"• {benefit}")
                            
                            st.markdown("#### Differentiation")
                            st.write(value_prop.get('differentiation', 'Not available'))
                            st.markdown('</div>', unsafe_allow_html=True)
                            
                            # Obstacles & Mitigation
                            st.subheader("Potential Obstacles & Mitigation")
                            obstacles = sales_strategy.get('potentialObstaclesMitigation', {})
                            
                            st.markdown('<div class="strategy-section">', unsafe_allow_html=True)
                            for key, obstacle in obstacles.items():
                                if isinstance(obstacle, dict):
                                    st.markdown(f"**{obstacle.get('description', 'Obstacle')}**")
                                    st.write(f"*Mitigation:* {obstacle.get('mitigation', 'Not available')}")
                                    st.markdown("---")
                            st.markdown('</div>', unsafe_allow_html=True)
                            
                            # Engagement Strategy
                            st.subheader("Engagement Strategy")
                            engagement = sales_strategy.get('engagementStrategy', [])
                            
                            st.markdown('<div class="strategy-section">', unsafe_allow_html=True)
                            for item in engagement:
                                st.markdown(f"• {item}")
                            st.markdown('</div>', unsafe_allow_html=True)
                            
                            # Competitor Analysis
                            st.subheader("Competitor Analysis")
                            competitors = sales_strategy.get('competitorAnalysis', [])
                            
                            if competitors:
                                col1, col2 = st.columns(2)
                                for i, competitor in enumerate(competitors):
                                    with col1 if i % 2 == 0 else col2:
                                        st.markdown('<div class="competitor-card">', unsafe_allow_html=True)
                                        st.markdown(f"### {competitor.get('competitor', 'Competitor')}")
                                        
                                        st.markdown("**Strengths:**")
                                        strengths = competitor.get('strengths', [])
                                        for strength in strengths:
                                            st.markdown(f"• {strength}")
                                        
                                        st.markdown("**Weaknesses:**")
                                        weaknesses = competitor.get('weaknesses', [])
                                        for weakness in weaknesses:
                                            st.markdown(f"• {weakness}")
                                        st.markdown('</div>', unsafe_allow_html=True)
                            
                            # CCS Score
                            st.subheader("Customer Compatibility Score (CCS)")
                            ccs_score = sales_strategy.get('ccsScore', 0)
                            
                            # Create a gauge-like visualization
                            score_color = "#4CAF50" if ccs_score >= 85 else "#FFC107" if ccs_score >= 75 else "#F44336"
                            
                            # Create a progress bar for the CCS score
                            st.progress(ccs_score/100)
                            st.markdown(f'<p style="text-align:center; font-size:24px; font-weight:bold; color:{score_color}">{ccs_score}/100</p>', unsafe_allow_html=True)
                            
                            if ccs_score >= 85:
                                st.success("Excellent compatibility with this prospect")
                            elif ccs_score >= 75:
                                st.warning("Good compatibility with this prospect")
                            else:
                                st.error("Average compatibility - may require additional effort")
                        
                        # Raw JSON option
                        with st.expander("View raw JSON data"):
                            st.json(result)
                    except ValueError:
                        st.error("Received an invalid response from the server.")
                        st.code(response.text)
                else:
                    st.error(f"Error: Failed to generate sales strategy. Status: {response.status_code}")
                    try:
                        error_data = response.json()
                        st.json(error_data)
                    except:
                        st.text(f"Response text: {response.text}")
            except requests.exceptions.RequestException as e:
                st.error(f"Network error: {str(e)}")

# Upload Document API
elif selected_api == "Upload Document":
    st.title("Upload Document")
    st.write("Upload a PDF document to the SalesGPT knowledge base")
    
    # Upload file
    uploaded_file = st.file_uploader("Choose a PDF file", type="pdf")
    user_id = st.text_input("User ID (optional)", "anonymous")
    
    if uploaded_file is not None:
        file_info = {
            "Filename": uploaded_file.name,
            "Size": f"{uploaded_file.size / 1024:.2f} KB",
            "Type": uploaded_file.type
        }
        st.write("File information:", file_info)
        
        if st.button("Upload Document"):
            with st.spinner("Uploading document..."):
                files = {"document": uploaded_file}
                data = {"userId": user_id}
                
                response = api_call("documents/upload", method="POST", data=data, files=files)
                
                if response and response.status_code in [200, 202]:
                    result = response.json()
                    st.success("Document uploaded successfully!")
                    
                    st.subheader("Document Information")
                    st.write(f"Document ID: `{result.get('documentId')}`")
                    st.write(f"File name: {result.get('fileData', {}).get('originalName')}")
                    st.write(f"File size: {result.get('fileData', {}).get('size')} bytes")
                    
                    # Display full response in expander
                    with st.expander("View full response"):
                        st.json(result)
                else:
                    status = response.status_code if response else "Unknown"
                    st.error(f"Error: Failed to upload document. Status: {status}")
                    if response:
                        try:
                            st.json(response.json())
                        except:
                            st.error("Could not parse error response")

# Query Documents API
elif selected_api == "Query Documents":
    st.title("Query Documents")
    st.write("Search for information across your uploaded documents")
    
    # Query input
    query = st.text_area("Enter your query", "What are the key challenges in the sales process?")
    limit = st.slider("Number of results", 1, 10, 5)
    
    if st.button("Search Documents"):
        with st.spinner("Searching documents..."):
            payload = {
                "query": query,
                "limit": limit
            }
            
            response = api_call("documents/query", method="POST", data=payload)
            
            if response and response.status_code == 200:
                result = response.json()
                
                # Handle potentially different response formats
                if 'results' in result and 'documents' in result['results']:
                    documents = result['results']['documents'][0] if len(result['results']['documents']) > 0 else []
                    metadatas = result['results']['metadatas'][0] if len(result['results']['metadatas']) > 0 else []
                    
                    st.success(f"Found {len(documents)} matching documents")
                    
                    for i, (doc, meta) in enumerate(zip(documents, metadatas)):
                        with st.expander(f"Result {i+1}: {meta.get('originalName', 'Document')}"):
                            st.markdown("**Document Excerpt:**")
                            st.text(doc[:1000] + ("..." if len(doc) > 1000 else ""))
                            
                            st.markdown("**Metadata:**")
                            st.json(meta)
                else:
                    st.warning("Response format is different than expected")
                    st.json(result)
            else:
                status = response.status_code if response else "Unknown"
                st.error(f"Error: Failed to query documents. Status: {status}")
                if response:
                    try:
                        st.json(response.json())
                    except:
                        st.error("Could not parse error response")

# Document Details API
elif selected_api == "Document Details":
    st.title("Document Details")
    st.write("View details of a specific document")
    
    document_id = st.text_input("Document ID", "")
    
    if document_id and st.button("Get Document Details"):
        with st.spinner("Fetching document details..."):
            response = api_call(f"documents/{document_id}", method="GET")
            
            if response and response.status_code == 200:
                result = response.json()
                st.success("Document details retrieved successfully")
                
                # Display document metadata
                st.subheader("Document Metadata")
                metadata = result.get('metadata', {})
                if metadata:
                    metadata_df = pd.DataFrame({
                        "Attribute": list(metadata.keys()),
                        "Value": list(metadata.values())
                    })
                    st.table(metadata_df)
                else:
                    st.warning("No metadata found in the response")
                
                # Show full response in expander
                with st.expander("View full response"):
                    st.json(result)
            else:
                status = response.status_code if response else "Unknown"
                st.error(f"Error: Failed to get document details. Status: {status}")
                if response:
                    try:
                        st.json(response.json())
                    except:
                        st.error("Could not parse error response")

# Generate Document-Based Strategy API
elif selected_api == "Generate Document-Based Strategy":
    st.title("Generate Document-Based Sales Strategy")
    st.write("Generate a sales strategy using insights from uploaded documents")
    
    # Input fields
    col1, col2 = st.columns(2)
    with col1:
        document_id = st.text_input("Document ID", "")
    with col2:
        company_name = st.text_input("Company Name", "Google")
    
    # Advanced options
    with st.expander("Advanced Options"):
        timeout = st.slider("Request Timeout (seconds)", 30, 300, 120)
    
    if document_id and company_name and st.button("Generate Strategy"):
        with st.spinner("Generating document-based sales strategy..."):
            payload = {
                "documentId": document_id,
                "companyName": company_name
            }
            
            response = api_call("documents/generateSalesStrategy", method="POST", data=payload, timeout=timeout)
            
            if response and response.status_code == 200:
                result = response.json()
                st.success("Document-based sales strategy generated successfully!")
                
                # Display company info
                st.subheader("Company Information")
                company_info = result.get('companyInfo', {})
                if company_info:
                    st.json(company_info)
                
                # Display sales strategy
                st.subheader("Sales Strategy")
                strategy = result.get('salesStrategy', "")
                st.markdown(strategy)
                
                # Raw JSON option
                with st.expander("View raw JSON data"):
                    st.json(result)
            else:
                status = response.status_code if response else "Unknown"
                st.error(f"Error: Failed to generate document-based strategy. Status: {status}")
                
                # Check for specific error types
                if response:
                    try:
                        error_data = response.json()
                        if "error" in error_data and "Vertex AI API" in str(error_data):
                            st.markdown(
                                """
                                <div class="warning">
                                <strong>Vertex AI API Error:</strong> The Google Vertex AI API appears to be disabled or not properly set up.
                                <br><br>
                                <strong>How to fix this:</strong>
                                <ol>
                                <li>Go to the <a href="https://console.developers.google.com/apis/api/aiplatform.googleapis.com/overview?project=magiq-ai" target="_blank">Google Cloud Console</a></li>
                                <li>Enable the Vertex AI API for your project</li>
                                <li>Wait a few minutes for the changes to propagate</li>
                                <li>Try again</li>
                                </ol>
                                </div>
                                """,
                                unsafe_allow_html=True
                            )
                        st.json(error_data)
                    except:
                        st.error("Could not parse error response")

# System Status section
with st.sidebar:
    st.markdown("---")
    st.subheader("System Status")
    
    # Check API health
    if st.button("Check API Status"):
        try:
            response = api_call("", method="GET", timeout=5)
            if response and response.status_code == 200:
                st.success("API Server is running")
            else:
                st.error("API Server is not responding correctly")
        except Exception as e:
            st.error(f"Error checking API: {str(e)}")
    
    # Display server info
    st.info("SalesGPT Backend Client v1.1")
    st.caption("© 2024 SalesGPT")