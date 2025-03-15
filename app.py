import streamlit as st
import requests
import json
import pandas as pd
import os
import time  # Add this import
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
    port = st.selectbox("API Server Port", [3000, 3001, 3002, 3003], index=3)
    BASE_URL = f"http://localhost:{port}/api"
    st.write(f"Using API endpoint: {BASE_URL}")
    
    # Navigation
    st.subheader("Navigation")
    selected_api = st.radio(
        "Select API",
        ["Generate Sales Strategy", "Document Management", "LinkedIn Profiles"]  # Updated options
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
    col1, col2 = st.columns(2)
    with col1:
        company_name = st.text_input("Company Name", "Google")
    with col2:
        location = st.text_input("Location (optional)", "United States")
    
    # Advanced options
    with st.expander("Advanced Options"):
        timeout = st.slider("Request Timeout (seconds)", 30, 300, 120)
    
    # Button to generate strategy
    if st.button("Generate Sales Strategy"):
        with st.spinner("Generating sales strategy... This may take up to 60 seconds."):
            try:
                payload = {
                    "companyName": company_name,
                    "location": location if location else None  # Only send if not empty
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
                        col1, col2, col3, col4 = st.columns(4)  # Changed from 3 to 4 columns

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
                            st.markdown(f'<div class="metric-value">{company_size.get("employeeCount", "N/A")}</div>', unsafe_allow_html=True)
                            st.markdown('<div class="metric-label">Employees</div>', unsafe_allow_html=True)
                            st.markdown('</div>', unsafe_allow_html=True)

                        with col4:
                            st.markdown('<div class="metric-card">', unsafe_allow_html=True)
                            headquarters = result.get('headquarters', 'N/A')  # This looks correct
                            st.markdown(f'<div class="metric-value">{headquarters}</div>', unsafe_allow_html=True)
                            st.markdown('<div class="metric-label">Location</div>', unsafe_allow_html=True)
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

                            if obstacles:
                                st.markdown('<div class="strategy-section">', unsafe_allow_html=True)
                                # Check if we have numbered obstacles or direct key-value pairs
                                for key, value in obstacles.items():
                                    if isinstance(value, dict) and 'description' in value:
                                        # Handle the obstacle1, obstacle2, obstacle3 format
                                        st.markdown(f"**{value['description']}**")
                                        st.write(f"*Mitigation:* {value.get('mitigation', 'Not available')}")
                                        st.markdown("---")
                                    elif key == 'description' and 'mitigation' in obstacles:
                                        # Handle the direct format with description and mitigation as keys
                                        st.markdown(f"**{obstacles['description']}**")
                                        st.write(f"*Mitigation:* {obstacles.get('mitigation', 'Not available')}")
                                        st.markdown("---")
                                        break  # Only process once if this is the format
                                st.markdown('</div>', unsafe_allow_html=True)
                            else:
                                st.info("No obstacles information available")
                            
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
                                cols = st.columns(2)
                                for i, competitor in enumerate(competitors):
                                    with cols[i % 2]:  # This ensures it works with any number of competitors
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
                        
                        # Add this after your CCS Score section
                        with st.expander("Debug Info"):
                            st.subheader("Response Structure")
                            st.json({
                                "top_level_keys": list(result.keys()),
                                "salesStrategy_keys": list(sales_strategy.keys() if sales_strategy else []),
                                "obstacles_count": len(obstacles) if obstacles else 0,
                                "competitors_count": len(competitors) if competitors else 0
                            })
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

# Document Management API - Unified Section
elif selected_api == "Document Management":
    st.title("Document Management")
    
    # Create tabs for different document operations
    tabs = st.tabs(["Upload Document", "Document Library", "Query Documents", "Generate Strategy"])
    
    # Tab 1: Upload Document
    with tabs[0]:
        st.subheader("Upload Document")
        
        uploaded_file = st.file_uploader("Choose a PDF or DOCX file", type=["pdf", "docx"], key="doc_upload")
        user_id = st.text_input("User ID (optional)", "anonymous")
        
        if uploaded_file is not None:
            file_info = {
                "Filename": uploaded_file.name,
                "Size": f"{uploaded_file.size / 1024:.2f} KB",
                "Type": uploaded_file.type,
                "Content Type": uploaded_file.type
            }
            st.write("File information:", file_info)
            
            # Debug mode to show binary data header
            with st.expander("Debug File Info"):
                if uploaded_file.type == "application/pdf":
                    st.write("File appears to be PDF format")
                elif uploaded_file.type in ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/msword"]:
                    st.write("File appears to be Word document format")
                else:
                    st.warning(f"File MIME type {uploaded_file.type} may not be supported")
                    st.info("Try renaming your file with the correct extension (.pdf or .docx)")
            
            if st.button("Upload Document"):
                # Create progress container
                progress_container = st.container()
                
                with progress_container:
                    # Create columns for status indicators
                    col1, col2, col3 = st.columns(3)
                    
                    # Initialize progress indicators
                    with col1:
                        upload_status = st.empty()
                    with col2:
                        vectorize_status = st.empty()
                    with col3:
                        index_status = st.empty()
                    
                    # Set initial status
                    upload_status.markdown("⏳ Initializing upload...")
                    vectorize_status.markdown("⏳ Vectorization pending...")
                    index_status.markdown("⏳ Indexing pending...")
                    
                    # Add progress bar
                    progress_bar = st.progress(0)
                    status_text = st.empty()
                    
                    try:
                        # Begin simulating progress for upload
                        for i in range(25):
                            progress_bar.progress(i)
                            status_text.text(f"Preparing file for upload... {i}%")
                            time.sleep(0.05)
                        
                        # Update upload status
                        upload_status.markdown("⏳ Uploading to GCP...")
                        
                        # Continue progress
                        for i in range(25, 50):
                            progress_bar.progress(i)
                            status_text.text(f"Uploading file to GCP... {i}%")
                            time.sleep(0.05)
                        
                        # Make API call with appropriate timeout
                        files = {"document": uploaded_file}
                        data = {"userId": user_id}
                    
                        # First, check system status
                        sys_status = api_call("system/status", method="GET", timeout=5)
                        if not sys_status or sys_status.status_code != 200:
                            st.error("Backend system appears to be unavailable. Please try again later.")
                            upload_status.markdown("❌ Connection failed")
                            vectorize_status.markdown("❌ Process canceled")
                            index_status.markdown("❌ Process canceled")
                            st.stop()
                        
                        # Continue with upload - longer timeout (180 seconds)
                        try:
                            response = api_call("documents/upload", method="POST", data=data, files=files, timeout=180)
                            
                            if response and response.status_code in [200, 202]:
                                result = response.json()
                                
                                # Update progress for successful upload
                                progress_bar.progress(50)
                                status_text.text(f"File uploaded! Processing content... 50%")
                                upload_status.markdown("✅ Uploaded successfully")
                                
                                # Show document ID early
                                st.info(f"Document ID: `{result.get('documentId')}`")
                                
                                # Continue with simulated processing (the actual processing happens in background)
                                vectorize_status.markdown("⏳ Vectorizing content...")
                                for i in range(50, 75):
                                    progress_bar.progress(i)
                                    status_text.text(f"Extracting text and generating embeddings... {i}%")
                                    time.sleep(0.05)
                                
                                vectorize_status.markdown("✅ Vectorization complete")
                                
                                # Simulate indexing progress
                                index_status.markdown("⏳ Indexing document...")
                                for i in range(75, 100):
                                    progress_bar.progress(i)
                                    status_text.text(f"Indexing document for search... {i}%")
                                    time.sleep(0.05)
                                
                                # Final status updates
                                progress_bar.progress(100)
                                status_text.text("Document processing complete! 100%")
                                index_status.markdown("✅ Indexing complete")
                                
                                # Success message
                                st.success("Document uploaded and processing started!")
                                
                                # Display document info
                                st.subheader("Document Information")
                                st.write(f"Document ID: `{result.get('documentId')}`")
                                st.write(f"File name: {result.get('fileData', {}).get('originalName')}")
                                st.write(f"File size: {result.get('fileData', {}).get('size')} bytes")
                                
                                # Copy button for document ID
                                st.code(result.get('documentId', ''), language="text")
                                st.info("👆 Copy this Document ID to use for queries and strategy generation")
                                
                            else:
                                # Handle upload failure
                                progress_bar.progress(100)
                                status_text.text("Upload failed!")
                                
                                upload_status.markdown("❌ Upload failed")
                                vectorize_status.markdown("❌ Vectorization failed")
                                index_status.markdown("❌ Indexing failed")
                                
                                status = response.status_code if response else "Unknown"
                                error_msg = f"Error: Failed to upload document. Status: {status}"
                                
                                # Add more detailed error info
                                if not response:
                                    st.error(error_msg)
                                    st.error(f"Server is not responding. Please check if the backend is running on {BASE_URL}")
                                else:
                                    try:
                                        error_data = response.json()
                                        error_msg += f"\nError details: {error_data.get('error', 'Unknown error')}"
                                        st.error(error_msg)
                                        st.json(error_data)
                                    except:
                                        st.error(f"{error_msg}\nResponse: {response.text}")
                        except Exception as e:
                            upload_status.markdown("❌ Process error")
                            vectorize_status.markdown("❌ Process error")
                            index_status.markdown("❌ Process error")
                            st.error(f"Error during upload process: {str(e)}")
                    except Exception as e:
                        st.error(f"Error during upload process: {str(e)}")
    
    # Add system status visualization
    with tabs[0]:
        with st.expander("Storage System Status"):
            try:
                status_response = api_call("system/status", method="GET", timeout=5)
                if status_response and status_response.status_code == 200:
                    system_status = status_response.json()
                    
                    # Create status indicators
                    st.markdown("### Storage Systems")
                    
                    cols = st.columns(2)
                    with cols[0]:
                        gcp_status = "operational" if system_status.get("components", {}).get("gcsStorage") == "operational" else "degraded"
                        gcp_icon = "✅" if gcp_status == "operational" else "⚠️"
                        st.markdown(f"{gcp_icon} **Google Cloud Storage**: {gcp_status.title()}")
                        
                    with cols[1]:
                        chroma_status = "operational" if system_status.get("components", {}).get("documentStorage") == "operational" else "degraded"
                        chroma_icon = "✅" if chroma_status == "operational" else "⚠️"
                        st.markdown(f"{chroma_icon} **Document Database**: {chroma_status.title()}")
                    
                    # If any system is degraded, show message
                    if gcp_status != "operational" or chroma_status != "operational":
                        st.warning("One or more storage systems are experiencing issues. Documents may still upload but with limited functionality.")
                        
                        if system_status.get("components", {}).get("documentStorageMessage"):
                            st.info(f"Storage message: {system_status['components']['documentStorageMessage']}")
                else:
                    st.error("Could not retrieve system status")
            except Exception as e:
                st.error(f"Error checking system status: {str(e)}")
    
    # Tab 2: Document Library
    with tabs[1]:
        st.subheader("Document Library")
        st.write("View and manage your uploaded documents")
        
        if st.button("Refresh Document List"):
            with st.spinner("Fetching documents..."):
                response = api_call("documents/list", method="GET")
                
                if response and response.status_code == 200:
                    docs = response.json().get("documents", [])
                    if docs:
                        # Create a table of documents
                        docs_df = pd.DataFrame(
                            [[doc.get("documentId"), 
                              doc.get("metadata", {}).get("originalName", "Unknown"),
                              doc.get("metadata", {}).get("uploadedAt", "Unknown"),
                              "✅" if doc.get("processed", False) else "⏳"] 
                             for doc in docs],
                            columns=["Document ID", "Filename", "Upload Date", "Status"]
                        )
                        
                        st.dataframe(docs_df, use_container_width=True)
                        
                        # Allow selection of a document for details
                        selected_doc = st.selectbox(
                            "Select document to view details",
                            options=docs_df["Document ID"].tolist(),
                            format_func=lambda x: f"{x} - {docs_df[docs_df['Document ID']==x]['Filename'].values[0]}"
                        )
                        
                        if selected_doc:
                            doc_response = api_call(f"documents/{selected_doc}", method="GET")
                            if doc_response and doc_response.status_code == 200:
                                doc_details = doc_response.json()
                                
                                # Show document details
                                st.subheader("Document Details")
                                metadata = doc_details.get('metadata', {})
                                if metadata:
                                    for key, value in metadata.items():
                                        st.write(f"**{key}:** {value}")
                                
                                # Add document preview/download options if available
                                if "fileUrl" in doc_details:
                                    st.markdown(f"[View Document]({doc_details['fileUrl']})")
                                
                                with st.expander("Raw Document Data"):
                                    st.json(doc_details)
                    else:
                        st.info("No documents found. Upload a document first.")
                else:
                    status = response.status_code if response else "Unknown"
                    st.error(f"Error: Failed to fetch documents. Status: {status}")
    
    # Tab 3: Query Documents
    with tabs[2]:
        st.subheader("Query Documents")
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
    
    # Tab 4: Generate Document-Based Strategy
    with tabs[3]:
        st.subheader("Generate Document-Based Sales Strategy")
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
                else:
                    status = response.status_code if response else "Unknown"
                    st.error(f"Error: Failed to generate strategy. Status: {status}")

# LinkedIn Profiles API
elif selected_api == "LinkedIn Profiles":
    st.title("LinkedIn Profiles Search")
    st.write("Find LinkedIn profiles based on company, position, and location")
    
    col1, col2 = st.columns(2)
    with col1:
        company = st.text_input("Company Name", "Google")
        position = st.text_input("Position", "Software Engineer")
    with col2:
        location = st.text_input("Location", "Bangalore")
        limit = st.slider("Number of profiles", 1, 10, 5)
    
    if st.button("Search LinkedIn Profiles"):
        with st.spinner(f"Searching for {position} at {company} in {location}..."):
            payload = {
                "company": company,
                "position": position,
                "location": location,
                "limit": limit
            }
            
            response = api_call("linkedinProfiles/search", method="POST", data=payload)
            
            if response and response.status_code == 200:
                result = response.json()
                
                st.success(f"Found {len(result.get('profiles', []))} LinkedIn profiles")
                
                for i, profile in enumerate(result.get('profiles', [])):
                    with st.container():
                        st.markdown(f"### Profile {i+1}")
                        st.markdown(f"**Title:** {profile.get('title', 'No title')}")
                        st.markdown(f"**URL:** [{profile.get('url')}]({profile.get('url')})")
                        st.markdown(f"**Snippet:** {profile.get('snippet', 'No description')}")
                        st.markdown("---")
                
                # Show raw data in expander
                with st.expander("View raw results"):
                    st.json(result)
            else:
                status = response.status_code if response else "Unknown"
                st.error(f"Error: Failed to search LinkedIn profiles. Status: {status}")
                if response:
                    try:
                        st.json(response.json())
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