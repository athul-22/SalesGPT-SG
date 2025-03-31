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

# Define the base URL for your API - updated to remote server
BASE_URL = "http://13.201.83.141:3000/api"

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
    server_options = ["13.201.83.141:3000", "localhost:3000", "localhost:3001", "localhost:3002", "localhost:3003"]
    server = st.selectbox("API Server", server_options, index=0)
    
    # Update BASE_URL based on selection
    if "localhost" in server:
        BASE_URL = f"http://{server}/api"
    else:
        BASE_URL = f"http://{server}/api"
    
    st.write(f"Using API endpoint: {BASE_URL}")
    
    # Navigation
    st.subheader("Navigation")
    selected_api = st.radio(
        "Select API",
        ["Generate Sales Strategy", "Document Management", "LinkedIn Profiles"]
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
    
    # Input fields - expanded to match API parameters
    col1, col2 = st.columns(2)
    with col1:
        company_name = st.text_input("Company Name", "Google")
        industry = st.text_input("Industry (optional)", "")
    with col2:
        location = st.text_input("Location (optional)", "United States")
        business_type = st.text_input("Business Type (optional)", "")
    
    # Add role in a separate row
    role = st.text_input("Target Role (optional)", "")
    
    # Advanced options
    with st.expander("Advanced Options"):
        timeout = st.slider("Request Timeout (seconds)", 30, 300, 120)
    
    # Add an option to select the data source
    data_source = st.radio(
        "Select Data Source",
        ["Standard API", "Exa.ai (Web Search)"],
        horizontal=True
    )

    # Button to generate strategy
    if st.button("Generate Sales Strategy"):
        with st.spinner("Generating sales strategy... This may take up to 60 seconds."):
            try:
                # Create payload with all parameters
                payload = {
                    "companyName": company_name,
                    "targetGeography": location if location else None,
                    "businessType": business_type if business_type else None,
                    "industry": industry if industry else None,
                    "role": role if role else None
                }
                
                # Remove None values
                payload = {k: v for k, v in payload.items() if v is not None}
                
                # Select the appropriate endpoint based on user choice
                endpoint = "generateExaSalesStrategy" if data_source == "Exa.ai (Web Search)" else "generateSalesStrategy"
                
                # Add more detailed timeout and error handling
                response = api_call(endpoint, method="POST", data=payload, timeout=timeout)
                
                if response is None:
                    st.error("Server is not responding. Please check if the backend is running.")
                    st.info("Make sure your backend server is running on: " + BASE_URL)
                elif response.status_code == 200:
                    try:
                        result = response.json()
                        
                        if result is None:
                            st.error("Received empty response from server")
                        else:
                            # Display errors if present
                            if 'errors' in result and result.get('errors') is not None:
                                error_details = result.get('errors', {})
                                
                                if error_details.get('companyError'):
                                    st.error(f"⚠️ {error_details.get('companyError')}")
                                
                                if error_details.get('aiError'):
                                    st.error(f"⚠️ AI Service Error: {error_details.get('aiError')}")
                                
                                if error_details.get('usingFallback'):
                                    st.warning("Using limited data for sales strategy generation.")
                            
                            # Display the results as before
                            st.success("Sales strategy generated successfully!")
                            
                            # Company overview section
                            st.header(f"{result.get('companyName', 'Company')} Sales Strategy")
                            
                            # Company metrics in a nice row
                            col1, col2, col3, col4 = st.columns(4)

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
                                headquarters = result.get('headquarters', 'N/A')
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
                                
                                # Remove CCS Score section as requested
                                
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

# Document Management API - Unified Section
elif selected_api == "Document Management":
    st.title("Document Management")
    
    # Create tabs for different document operations
    tabs = st.tabs(["Upload Document", "Document Library", "Google Drive Integration", "Query Documents", "Generate Strategy"])
    
    # Tab 1: Upload Document 
    with tabs[0]:
        st.subheader("Upload Document")
        
        # Simple server status check
        if api_call("system/status", timeout=2):
            st.success("Server is online")
        else:
            st.error("Server is offline")
        
        # Document uploader
        uploaded_file = st.file_uploader("Choose a PDF or DOCX file", type=["pdf", "docx"])
        
        # Add processing options to help with rate limiting
        with st.expander("Advanced Options"):
            processing_mode = st.radio(
                "Processing mode",
                ["Standard", "Optimized for large documents"],
                help="Optimized mode uses smaller chunks and slower processing to avoid rate limits"
            )
            
            chunk_size = st.slider(
                "Chunk size", 
                min_value=100, 
                max_value=1000, 
                value=250,
                help="Smaller chunks help avoid rate limits but process slower"
            )
        
        if uploaded_file is not None:
            st.write(f"File: {uploaded_file.name} ({uploaded_file.size/1024:.1f} KB)")
            
            # Display recommendations for large files
            if uploaded_file.size > 1024 * 1024:  # If file is larger than 1MB
                st.warning("""
                ⚠️ Large file detected. To avoid rate limit errors:
                - Use the "Optimized for large documents" processing mode
                - Reduce chunk size in advanced options
                - Wait for processing to complete before uploading more files
                """)
            
            if st.button("Upload Document"):
                with st.spinner("Uploading and processing document..."):
                    # Progress bar
                    progress_bar = st.progress(0)
                    status_text = st.empty()
                    
                    # Simulate initial progress
                    for i in range(40):
                        progress_bar.progress(i)
                        status_text.text(f"Uploading file... {i}%")
                        time.sleep(0.02)
                    
                    # Prepare payload with advanced options
                    files = {"document": uploaded_file}
                    data = {}
                    
                    if processing_mode == "Optimized for large documents":
                        data["optimized"] = "true"
                        data["chunkSize"] = str(chunk_size)
                    
                    # Actual upload
                    response = api_call("documents/upload", method="POST", files=files, data=data, timeout=120)
                    
                    # Update progress based on response
                    if response and response.status_code in [200, 202]:
                        result = response.json()
                        document_id = result.get('documentId')
                        
                        # Continue progress animation
                        for i in range(40, 90):
                            progress_bar.progress(i)
                            status_text.text(f"Processing document... {i}%")
                            time.sleep(0.02)
                        
                        # Show success message but inform about background processing
                        progress_bar.progress(90)
                        status_text.text("Document queued successfully!")
                        
                        st.success("Document uploaded and queued for processing")
                        st.info(f"Document ID: {document_id}")
                        
                        # Add a polling mechanism to check processing status
                        if st.checkbox("Check processing status"):
                            status_container = st.empty()
                            
                            for _ in range(5):  # Poll a few times
                                status_resp = api_call(f"documents/{document_id}/status", method="GET")
                                
                                if status_resp and status_resp.status_code == 200:
                                    status_data = status_resp.json()
                                    
                                    if status_data.get("status") == "completed":
                                        progress_bar.progress(100)
                                        status_container.success("Processing completed successfully!")
                                        break
                                    elif status_data.get("status") == "failed":
                                        progress_bar.progress(100)
                                        status_container.error(f"Processing failed: {status_data.get('error')}")
                                        if "rate limit" in status_data.get("error", "").lower():
                                            st.warning("""
                                            Rate limit exceeded. Try again with:
                                            - Smaller chunk size
                                            - Wait a few minutes before retrying
                                            """)
                                        break
                                    else:
                                        progress = status_data.get("progress", 0)
                                        progress_bar.progress(40 + int(progress * 0.5))  # Scale to fit in our range
                                        status_container.info(f"Processing: {status_data.get('status')} ({progress}%)")
                                
                                time.sleep(3)  # Wait between polls
                    else:
                        progress_bar.progress(100)
                        status_text.text("Upload failed")
                        
                        if response:
                            error_message = "Unknown error"
                            try:
                                error_data = response.json()
                                error_message = error_data.get("error", "Unknown error")
                            except:
                                error_message = response.text
                                
                            st.error(f"Upload failed: {error_message}")
                            
                            # Special handling for rate limit errors
                            if response.status_code == 429 or "rate limit" in error_message.lower():
                                st.warning("""
                                ⚠️ Rate limit exceeded. Please try:
                                - Using optimized processing mode
                                - Reducing chunk size
                                - Waiting a few minutes before uploading again
                                """)
                        else:
                            st.error("Upload failed - server error")
    
    # Tab 2: Document Library
    with tabs[1]:
        st.subheader("Document Library")
        
        col1, col2 = st.columns([3, 1])
        
        with col1:
            st.write("Documents in your knowledge base")
        
        with col2:
            # Add a check for mock data option
            use_mock = st.checkbox("Use sample data", value=False, 
                                  help="If checked, displays sample documents when ChromaDB is unavailable")
        
        # Button to refresh or load mock data
        if st.button("Refresh Document List"):
            with st.spinner("Fetching documents..."):
                # Use mock list if selected, or if regular list fails
                if use_mock:
                    response = api_call("documents/mock-list", method="GET")
                else:
                    response = api_call("documents/list", method="GET")
                    
                    # Fall back to mock data if real data fails
                    if not response or response.status_code != 200:
                        st.warning("Could not fetch real documents, showing sample data instead")
                        response = api_call("documents/mock-list", method="GET")
                
                # Process the response
                if response and response.status_code == 200:
                    result = response.json()
                    docs = result.get("documents", [])
                    
                    # Check if there's an error message in the response
                    if "error" in result:
                        st.warning(f"⚠️ Backend Warning: {result['error']}")
                    
                    if docs:
                        # Create a table of documents
                        docs_df = pd.DataFrame(
                            [[doc.get("documentId", "Unknown"), 
                              doc.get("metadata", {}).get("originalName", "Unknown"),
                              doc.get("metadata", {}).get("uploadedAt", "Unknown"),
                              doc.get("metadata", {}).get("source", "upload"),
                              "✅" if doc.get("processed", False) else "⏳"] 
                             for doc in docs],
                            columns=["Document ID", "Filename", "Upload Date", "Source", "Status"]
                        )
                        
                        st.dataframe(docs_df, use_container_width=True)
                        
                        # Show document count summary
                        st.success(f"Found {len(docs)} documents in your collection")
                        
                        # Group documents by source
                        sources = docs_df["Source"].value_counts().to_dict()
                        source_text = ", ".join([f"{count} {source}" for source, count in sources.items()])
                        st.write(f"Sources: {source_text}")
                        
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
                        st.info("No documents found in your ChromaDB collection.")
                        
                        # Add helpful guidance for new users
                        st.markdown("""
                        ### To add documents:
                        1. **Upload a document** - Go to the 'Upload Document' tab and upload a PDF or DOCX file
                        2. **Import from Google Drive** - Go to the 'Google Drive Integration' tab to import documents
                        """)
                else:
                    status = response.status_code if response else "Unknown"
                    st.error(f"Error: Failed to fetch documents. Status: {status}")
                    
                    # Try to extract more detailed error information
                    try:
                        error_details = response.json()
                        st.json(error_details)
                    except:
                        st.error("Could not parse error response")
    
    # Tab 3: Google Drive Integration
    with tabs[2]:
        st.subheader("Google Drive Integration")
        st.write("Process documents from Google Drive")
        
        # Input for Google Drive folder ID
        drive_folder_id = st.text_input(
            "Google Drive Folder ID", 
            help="Enter the ID of the Google Drive folder containing your documents"
        )
        
        col1, col2 = st.columns(2)
        with col1:
            if st.button("List Files") and drive_folder_id:
                with st.spinner("Fetching files from Google Drive..."):
                    response = api_call(f"drive-documents/list?folderId={drive_folder_id}", method="GET")
                    
                    if response and response.status_code == 200:
                        files = response.json().get("files", [])
                        if files:
                            # Store files in session state for later use
                            st.session_state.drive_files = files
                            
                            # Create a table of files
                            files_df = pd.DataFrame(
                                [[
                                    file.get("name"),
                                    file.get("id"),
                                    file.get("mimeType"),
                                    "✅" if file.get("processed") else "⏳" 
                                ] for file in files],
                                columns=["Filename", "ID", "Type", "Status"]
                            )
                            
                            st.dataframe(files_df, use_container_width=True)
                        else:
                            st.info("No files found in the specified folder.")
                    else:
                        st.error("Failed to fetch files from Google Drive.")
        
        with col2:
            if st.button("Process All Files") and drive_folder_id:
                with st.spinner("Processing all files in folder..."):
                    payload = {"folderId": drive_folder_id}
                    response = api_call("drive-documents/process-folder", method="POST", data=payload)
                    
                    if response and response.status_code == 202:
                        result = response.json()
                        st.success(f"Processing started for {result.get('filesToProcess')} files.")
                        
                        # Show files that will be processed
                        st.write("Files being processed:")
                        for file in result.get("files", []):
                            st.write(f"• {file.get('name')}")
                            
                        st.info("This process runs in the background. Check the Document Library tab later to see the processed files.")
                    else:
                        st.error("Failed to start folder processing.")
        
        # Individual file processing
        if 'drive_files' in st.session_state and st.session_state.drive_files:
            st.subheader("Process Individual Files")
            
            # Allow selection of a file to process
            file_options = {f"{file['name']} ({file['id']})": file for file in st.session_state.drive_files}
            selected_file_key = st.selectbox("Select a file to process", options=list(file_options.keys()))
            
            if selected_file_key and st.button("Process Selected File"):
                selected_file = file_options[selected_file_key]
                
                with st.spinner(f"Processing file: {selected_file['name']}"):
                    payload = {
                        "fileId": selected_file["id"],
                        "fileName": selected_file["name"],
                        "folderId": drive_folder_id
                    }
                    
                    response = api_call("drive-documents/process", method="POST", data=payload)
                    
                    if response and response.status_code in [200, 202]:
                        result = response.json()
                        if result.get("status") == "completed":
                            st.success("File already processed successfully.")
                        else:
                            st.success("File processing started.")
                            st.info("This process runs in the background. Check the Document Library tab later to see the processed file.")
                    else:
                        st.error("Failed to process the selected file.")
    
    # Tab 4: Query Documents
    with tabs[3]:
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
    
    # Tab 5: Generate Document-Based Strategy
    with tabs[4]:
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
                    
                    if 'errors' in result and (result.get('errors', {}).get('companyError') or 
                                               result.get('errors', {}).get('documentError')):
                        if result.get('errors', {}).get('companyError'):
                            st.error(f"⚠️ Company data error: {result['errors']['companyError']}")
                        if result.get('errors', {}).get('documentError'):
                            st.warning(f"⚠️ Document search error: {result['errors']['documentError']}")
                    
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