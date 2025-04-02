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

# Initialize session state variables
if 'user_name' not in st.session_state:
    st.session_state.user_name = ""

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
        ["Generate Sales Strategy", "Document Management", "LinkedIn Profiles", "Sales Co-Pilot"]
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
    
    # Add user profile fields with proper options
    user_name = st.text_input("Your Name", key="user_name")
    user_business_type = st.selectbox("Your Business Type", options=["Service", "Product"])
    user_industry = st.text_input("Your Industry", "")
    user_role = st.text_input("Your Role", "")
    user_company = st.text_input("Your Company", "")
    user_location = st.text_input("Your Location", "")
    
    # Add user context field
    user_product_description = st.text_area("Describe your product/service", "")

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
                    "role": role if role else None,
                    "userProfile": {
                        "businessType": user_business_type,
                        "industry": user_industry,
                        "role": user_role,
                        "location": user_location,
                        "company": user_company
                    },
                    "userContext": {
                        "productDescription": user_product_description
                    }
                }

                # Add name to userProfile only if it exists and isn't empty
                if 'user_name' in st.session_state and st.session_state.user_name:
                    payload["userProfile"]["name"] = st.session_state.user_name
                
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
    doc_tabs = st.tabs(["Upload Document", "Document Library", "Google Drive"])
    
    with doc_tabs[0]:  # Upload Document
        st.header("Upload Document")
        st.write("Upload a document to the knowledge base")
        
        uploaded_file = st.file_uploader("Choose a file (PDF, DOCX)", type=["pdf", "docx"])
        
        if uploaded_file is not None:
            if st.button("Process Document"):
                with st.spinner("Uploading and processing document..."):
                    try:
                        # Process file upload
                        files = {"document": uploaded_file}
                        response = api_call("documents/upload", method="POST", files=files)
                        
                        if response and response.status_code in [200, 202]:
                            result = response.json()
                            st.success(f"Document uploaded successfully! ID: {result.get('documentId')}")
                            st.json(result)
                        else:
                            st.error(f"Error uploading document: {response.text if response else 'No response'}")
                    except Exception as e:
                        st.error(f"Error: {str(e)}")
    
    with doc_tabs[1]:  # Document Library
        st.header("Document Library")
        st.write("Browse and manage your uploaded documents")
        
        # Add debug option
        with st.expander("Debug ChromaDB Collections"):
            if st.button("List All ChromaDB Collections"):
                with st.spinner("Fetching all collections from ChromaDB..."):
                    try:
                        response = api_call("documents/listCollections", method="GET")
                        if response and response.status_code == 200:
                            st.json(response.json())
                        else:
                            st.error("Failed to retrieve collections")
                    except Exception as e:
                        st.error(f"Error: {str(e)}")
        
        if st.button("Refresh Document List"):
            with st.spinner("Fetching documents..."):
                try:
                    response = api_call("documents/list", method="GET")
                    
                    if response and response.status_code == 200:
                        result = response.json()
                        docs = result.get("documents", [])
                        
                        # Display debug information
                        st.caption(f"Total collections: {result.get('collectionsCount', 0)}")
                        st.caption(f"Document collections: {result.get('docCollectionsCount', 0)}")
                        
                        if not docs:
                            st.info("No documents found in the library.")
                            if result.get('message'):
                                st.warning(result.get('message'))
                        else:
                            # Display documents in a table
                            docs_data = []
                            for doc in docs:
                                metadata = doc.get("metadata", {})
                                docs_data.append({
                                    "ID": doc.get("documentId", "Unknown"),
                                    "Name": metadata.get("originalName", "Unknown"),
                                    "Uploaded": metadata.get("uploadedAt", "Unknown")[:10],
                                    "Size": f"{int(metadata.get('fileSize', 0)/1024)} KB",
                                    "Text Length": metadata.get("textLength", "Unknown")
                                })
                            
                            st.dataframe(docs_data)
                            
                            # Add option to view document details
                            if docs_data:
                                doc_id = st.selectbox("Select a document to view details:", 
                                                      [d["ID"] for d in docs_data])
                                
                                if st.button("View Document Details"):
                                    with st.spinner(f"Fetching document {doc_id}..."):
                                        doc_response = api_call(f"documents/{doc_id}", method="GET")
                                        if doc_response and doc_response.status_code == 200:
                                            st.json(doc_response.json())
                                        else:
                                            st.error(f"Error fetching document: {doc_response.text if doc_response else 'No response'}")
                    else:
                        st.error(f"Error fetching documents: {response.text if response else 'No response'}")
                except Exception as e:
                    st.error(f"Error: {str(e)}")
    
    with doc_tabs[2]:  # Google Drive
        st.header("Google Drive Integration")
        st.write("Connect to Google Drive and import documents")
        
        if st.button("List Drive Files"):
            with st.spinner("Fetching files from Google Drive..."):
                try:
                    response = api_call("drive/list", method="GET")
                    
                    if response and response.status_code == 200:
                        files = response.json().get("files", [])
                        
                        if not files:
                            st.info("No files found in Google Drive.")
                        else:
                            # Display files in a table
                            file_data = []
                            for file in files:
                                file_data.append({
                                    "ID": file.get("id", "Unknown"),
                                    "Name": file.get("name", "Unknown"),
                                    "Type": file.get("mimeType", "Unknown").split('/')[-1],
                                    "Size": f"{int(file.get('size', 0)/1024)} KB" if file.get('size') else "N/A"
                                })
                            
                            st.dataframe(file_data)
                            
                            # Add option to import selected files
                            file_to_import = st.selectbox("Select a file to import:", 
                                                          [f"{f['Name']} ({f['ID']})" for f in file_data])
                            
                            if st.button("Import Selected File"):
                                file_id = file_to_import.split("(")[-1].replace(")", "")
                                with st.spinner(f"Importing file {file_id}..."):
                                    import_response = api_call(f"drive/process/{file_id}", method="POST")
                                    if import_response and import_response.status_code in [200, 202]:
                                        st.success("File import started!")
                                        st.json(import_response.json())
                                    else:
                                        st.error(f"Error importing file: {import_response.text if import_response else 'No response'}")
                    else:
                        st.error(f"Error fetching Google Drive files: {response.text if response else 'No response'}")
                except Exception as e:
                    st.error(f"Error: {str(e)}")

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

# Sales Co-Pilot API
elif selected_api == "Sales Co-Pilot":
    st.title("Sales Co-Pilot")
    st.write("Your AI-powered assistant for account-based selling")
    
    # Initialize session state variables
    if 'messages' not in st.session_state:
        st.session_state.messages = []
    
    if 'company' not in st.session_state:
        st.session_state.company = ""
        
    if 'company_data' not in st.session_state:
        st.session_state.company_data = None
        
    if 'user_id' not in st.session_state:
        # Generate a random user ID if not exists
        import uuid
        st.session_state.user_id = str(uuid.uuid4())
    
    # Company selection section with added fields for location and role
    with st.container():
        col1, col2, col3 = st.columns([3, 2, 1])
        
        with col1:
            company_input = st.text_input(
                "Target Account Name",
                value=st.session_state.company,
                placeholder="Enter company name (e.g., Google, Microsoft)"
            )
        
        with col2:
            location_input = st.text_input(
                "Location",
                placeholder="e.g., United States, India"
            )
            
            role_input = st.text_input(
                "Target Role",
                placeholder="e.g., CTO, Marketing Director"
            )
        
        # Add user profile information
        with st.expander("Your Profile & Offering"):
            user_business_type = st.selectbox("Your Business Type", options=["Service", "Product"], key="copilot_business_type")
            user_industry = st.text_input("Your Industry", key="copilot_industry")
            user_role = st.text_input("Your Role", key="copilot_role")
            user_company = st.text_input("Your Company", key="copilot_company")
            user_location = st.text_input("Your Location", key="copilot_location")
            user_product_description = st.text_area("Describe your product/service", key="copilot_product_desc")
        
        with col3:
            if st.button("Set Company") and company_input:
                with st.spinner(f"Gathering information about {company_input}..."):
                    # First, get company data from the sales strategy API
                    payload = {
                        "companyName": company_input,
                        "targetGeography": location_input if location_input else None,
                        "role": role_input if role_input else None
                    }
                    
                    # Remove None values
                    payload = {k: v for k, v in payload.items() if v is not None}
                    
                    # Call the sales strategy API to get company information
                    response = api_call("generateSalesStrategy", method="POST", data=payload, timeout=60)
                    
                    if response and response.status_code == 200:
                        company_data = response.json()
                        st.session_state.company_data = company_data
                        st.session_state.company = company_input
                        st.session_state.messages = []  # Clear chat when changing company
                        st.success(f"Company set to: {company_input}")
                    else:
                        st.error("Failed to retrieve company information")
                        st.session_state.company_data = None
                        st.session_state.company = company_input
                        
                # Use experimental_rerun instead of rerun
                st.experimental_rerun()
    
    # Display current company and company data
    if st.session_state.company:
        st.markdown(f"### Chatting about: **{st.session_state.company}**")
        
        # Display company information if available
        if st.session_state.company_data:
            with st.expander("Company Information"):
                company_data = st.session_state.company_data
                
                # Display basic company info
                col1, col2, col3 = st.columns(3)
                with col1:
                    st.metric("Industry", company_data.get("industry", "Unknown"))
                with col2:
                    st.metric("Business Type", company_data.get("businessType", "Unknown"))
                with col3:
                    st.metric("Location", company_data.get("headquarters", "Unknown"))
                
                # Display company products/services
                st.subheader("Products & Services")
                products = company_data.get("productOrServiceDetails", [])
                if products:
                    for product in products:
                        st.markdown(f"• {product}")
                
                # Display pain points if available
                if "salesStrategy" in company_data and "currentSituation" in company_data["salesStrategy"]:
                    pain_points = company_data["salesStrategy"]["currentSituation"].get("painPointsAndMarketPressures", [])
                    if pain_points:
                        st.subheader("Pain Points")
                        for point in pain_points:
                            st.markdown(f"• {point}")
        
        # Optional: Add a button to clear conversation
        if st.button("Clear Conversation"):
            # Call API to clear conversation history
            response = api_call(
                "salesCoPilot/clearHistory", 
                method="POST", 
                data={
                    "userId": st.session_state.user_id,
                    "company": st.session_state.company
                }
            )
            
            if response and response.status_code == 200:
                st.session_state.messages = []
                st.success("Conversation cleared!")
                # Use experimental_rerun instead of rerun
                st.experimental_rerun()
            else:
                st.error("Failed to clear conversation history")
        
        # Display chat messages
        chat_container = st.container()
        with chat_container:
            for message in st.session_state.messages:
                if message["role"] == "user":
                    st.chat_message("user").write(message["content"])
                else:
                    st.chat_message("assistant").write(message["content"])
        
        # Follow-up suggestions container
        suggestion_container = st.container()
        
        # Input for new message
        prompt = st.chat_input("Ask about " + st.session_state.company)
        
        # Debug Tools section
        with st.expander("Debug Tools"):
            st.subheader("Test ChromaDB Connectivity")
            test_query = st.text_input("Test search query:", value=st.session_state.company)
            
            if st.button("Test ChromaDB Search"):
                with st.spinner("Testing ChromaDB search..."):
                    response = api_call(f"salesCoPilot/testChromaSearch?query={test_query}", timeout=30)
                    
                    if response and response.status_code == 200:
                        result = response.json()
                        st.json(result)
                        
                        if result.get("resultsFound"):
                            st.success("✅ ChromaDB is working and returned results!")
                        else:
                            st.warning("⚠️ ChromaDB is working but no results found.")
                            st.info("Collection details:")
                            st.json(result.get("summary", {}).get("collections", []))
                    else:
                        st.error("❌ Error connecting to ChromaDB")
                        if response:
                            try:
                                st.json(response.json())
                            except:
                                st.write(response.text)
        
        if prompt:
            # Add user message to chat
            st.session_state.messages.append({"role": "user", "content": prompt})
            
            # Display the user message
            with chat_container:
                st.chat_message("user").write(prompt)
            
            # Prepare company context from the sales strategy data
            company_context = ""
            if st.session_state.company_data:
                company_data = st.session_state.company_data
                company_context = f"""
                Company: {company_data.get('companyName', st.session_state.company)}
                Industry: {company_data.get("industry", "Unknown")}
                Business Type: {company_data.get("businessType", "Unknown")}
                Headquarters: {company_data.get("headquarters", "Unknown")}
                Products/Services: {', '.join(company_data.get("productOrServiceDetails", []))}
                """
                
                # Add pain points if available
                if "salesStrategy" in company_data and "currentSituation" in company_data["salesStrategy"]:
                    pain_points = company_data["salesStrategy"]["currentSituation"].get("painPointsAndMarketPressures", [])
                    if pain_points:
                        company_context += "Pain Points: " + ", ".join(pain_points)
            
            # Call the SalesCoPilot API with company context added
            with st.spinner("Thinking..."):
                payload = {
                    "company": st.session_state.company,
                    "query": prompt,
                    "userId": st.session_state.user_id,
                    "user_data": [company_context] if company_context else [],
                    "userProfile": {
                        "businessType": st.session_state.get("copilot_business_type", ""),
                        "industry": st.session_state.get("copilot_industry", ""),
                        "role": st.session_state.get("copilot_role", ""),
                        "location": st.session_state.get("copilot_location", ""),
                        "company": st.session_state.get("copilot_company", "")
                    },
                    "userContext": {
                        "productDescription": st.session_state.get("copilot_product_desc", "")
                    }
                }
                
                response = api_call("salesCoPilot", method="POST", data=payload, timeout=60)
                
                if response and response.status_code == 200:
                    result = response.json()
                    
                    # Extract the AI response
                    ai_response = result.get("response", "Sorry, I couldn't process your request.")
                    
                    # Add assistant message to chat
                    st.session_state.messages.append({"role": "assistant", "content": ai_response})
                    
                    # Display the assistant message
                    with chat_container:
                        st.chat_message("assistant").write(ai_response)
                    
                    # Display follow-up questions as clickable buttons
                    follow_up_questions = result.get("followUpQuestions", [])
                    if follow_up_questions:
                        with suggestion_container:
                            st.markdown("##### Suggested follow-up questions:")
                            cols = st.columns(len(follow_up_questions))
                            
                            for i, question in enumerate(follow_up_questions):
                                with cols[i]:
                                    if st.button(question, key=f"suggestion_{i}"):
                                        # When clicked, set as the next input
                                        st.session_state.next_question = question
                                        # Use experimental_rerun instead of rerun
                                        st.experimental_rerun()
                    
                    # Display any errors
                    if "errors" in result and result.get("errors"):
                        errors = result.get("errors", {})
                        with st.expander("Request Processing Information"):
                            if errors.get("companyError"):
                                st.warning(f"Company data: {errors.get('companyError')}")
                            if errors.get("documentError"):
                                st.info(f"Document search: {errors.get('documentError')}")
                else:
                    status = response.status_code if response else "Unknown"
                    error_msg = f"Error: Failed to get response. Status: {status}"
                    
                    # Add error message to chat
                    st.session_state.messages.append({"role": "assistant", "content": error_msg})
                    
                    # Display the error message
                    with chat_container:
                        st.chat_message("assistant").write(error_msg)
        
        # Check if we have a question from a suggestion button
        if "next_question" in st.session_state:
            prompt = st.session_state.next_question
            del st.session_state.next_question
            
            # Add user message to chat
            st.session_state.messages.append({"role": "user", "content": prompt})
            
            # Display the user message
            with chat_container:
                st.chat_message("user").write(prompt)
            
            # Use experimental_rerun instead of rerun
            st.experimental_rerun()
    else:
        # No company selected yet
        st.info("👆 Enter a company name above to start your Sales Co-Pilot conversation.")
        
        with st.expander("About Sales Co-Pilot"):
            st.markdown("""
            ### What is Sales Co-Pilot?
            
            Sales Co-Pilot is your AI assistant for account-based selling. It helps you:
            
            - **Research target accounts** with accurate company information
            - **Access your knowledge base** of uploaded documents
            - **Generate insights** for your sales conversations
            - **Prepare for meetings** with key stakeholders
            
            Simply enter a company name and start asking questions!
            """)

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