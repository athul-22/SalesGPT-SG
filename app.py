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
BASE_URL = "13.201.83.141:3000/api"

# Function to make API calls
def api_call(endpoint, method="GET", data=None, files=None, timeout=60):
    url = f"{BASE_URL}/{endpoint}"
    
    # Add API key authentication header
    headers = {
        'x-api-key': 'salesgpt-secure-key-xhsjdjwn2849wbfewdsknsk'
    }
    
    try:
        if method == "GET":
            response = requests.get(url, headers=headers, timeout=timeout)
        elif method == "POST":
            if files:
                # For multipart/form-data requests (file uploads)
                # Note: Don't add Content-Type header here as requests sets it with boundary
                response = requests.post(url, headers=headers, data=data, files=files, timeout=timeout)
            else:
                # For JSON requests
                response = requests.post(url, headers=headers, json=data, timeout=timeout)
        
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
    
    domain = st.text_input("Company Domain (optional)", "")
    
    # Add user profile fields with proper options
    st.subheader("Your Profile")
    user_name = st.text_input("Your Name", key="user_name")
    user_business_type = st.selectbox("Your Business Type", options=["Service", "Product", "IT Services", "Cloud Solutions"])
    user_industry = st.text_input("Your Industry", "Technology")
    user_role = st.text_input("Your Role", "Sales Director")
    user_company = st.text_input("Your Company", "CloudEdge Solutions")
    user_location = st.text_input("Your Location", "San Francisco")
    
    # Add education and previous employers with enhanced fields
    col1, col2 = st.columns(2)
    with col1:
        education_input = st.text_area("Education (one per line)", "Stanford University\nMIT")
        user_education = education_input.split('\n') if education_input else []
    
    with col2:
        employers_input = st.text_area("Previous Employers (one per line)", "Oracle\nSAP\nIBM")
        user_previous_employers = employers_input.split('\n') if employers_input else []
    
    # NEW: Add detailed work experience section
    st.subheader("Work Experience")
    work_exp_container = st.container()
    
    if "work_experiences" not in st.session_state:
        st.session_state.work_experiences = [{"company": "", "title": "", "years": "", "description": ""}]
    
    # Button to add more work experience entries
    if st.button("Add Work Experience"):
        st.session_state.work_experiences.append({"company": "", "title": "", "years": "", "description": ""})
    
    # Display work experience fields
    with work_exp_container:
        updated_experiences = []
        for i, exp in enumerate(st.session_state.work_experiences):
            st.markdown(f"##### Work Experience {i+1}")
            col1, col2 = st.columns(2)
            with col1:
                company = st.text_input(f"Company {i+1}", value=exp["company"], key=f"we_company_{i}")
                title = st.text_input(f"Title {i+1}", value=exp["title"], key=f"we_title_{i}")
            with col2:
                years = st.text_input(f"Years {i+1} (e.g. 2018-2020)", value=exp["years"], key=f"we_years_{i}")
                description = st.text_area(f"Description {i+1}", value=exp["description"], key=f"we_desc_{i}", 
                                          height=100)
            
            if company or title or years or description:
                updated_experiences.append({
                    "company": company,
                    "title": title,
                    "years": years,
                    "description": description
                })
            st.markdown("---")
        
        # Update session state with non-empty entries
        if updated_experiences:
            st.session_state.work_experiences = updated_experiences
    
    # Add user context field
    st.subheader("Your Product/Service")
    user_product_description = st.text_area("Describe your product/service", 
        "CloudEdge provides enterprise-grade cloud management solutions that help companies optimize their cloud infrastructure, reduce operational costs by up to 35%, and enhance security through AI-powered monitoring and automated remediation.")
    
    seller_offerings_input = st.text_area("Your Offerings (one per line)", 
        "Multi-Cloud Management Platform\nAI-Driven Infrastructure Optimization\nReal-time Application Monitoring\nCloud Security Posture Management\nServerless Computing Solutions")
    seller_offerings = seller_offerings_input.split('\n') if seller_offerings_input else []
    
    # NEW: Company Technologies used section
    st.subheader("Target Company Technologies")
    tech_stack_input = st.text_area("Technologies Used (one per line)", 
        "AWS\nGoogle Cloud Platform\nKubernetes\nDocker\nJava\nPython\nReact\nNode.js")
    tech_stack = tech_stack_input.split('\n') if tech_stack_input else []
    
    keywords = st.text_input("Keywords (comma separated)", "cloud, infrastructure, security, optimization")
    
    # NEW: Decision Makers section
    st.subheader("Decision Makers")
    decision_makers_container = st.container()
    
    if "decision_makers" not in st.session_state:
        st.session_state.decision_makers = [{
            "name": "", "position": "", "linkedin_url": "", 
            "education": [], "location": ""
        }]
    
    # Button to add more decision makers
    if st.button("Add Decision Maker"):
        st.session_state.decision_makers.append({
            "name": "", "position": "", "linkedin_url": "", 
            "education": [], "location": ""
        })
    
    # Display decision maker fields
    with decision_makers_container:
        updated_decision_makers = []
        for i, dm in enumerate(st.session_state.decision_makers):
            st.markdown(f"##### Decision Maker {i+1}")
            col1, col2 = st.columns(2)
            with col1:
                name = st.text_input(f"Name {i+1}", value=dm["name"], key=f"dm_name_{i}")
                position = st.text_input(f"Position {i+1}", value=dm["position"], key=f"dm_position_{i}")
            with col2:
                linkedin = st.text_input(f"LinkedIn URL {i+1}", value=dm["linkedin_url"], key=f"dm_linkedin_{i}")
                location = st.text_input(f"Location {i+1}", value=dm["location"], key=f"dm_location_{i}")
            
            edu_input = st.text_input(f"Education {i+1} (comma separated)", 
                                     key=f"dm_edu_{i}")
            education = [e.strip() for e in edu_input.split(',')] if edu_input else []
            
            if name or position or linkedin or location or education:
                updated_decision_makers.append({
                    "name": name,
                    "position": position,
                    "linkedin_url": linkedin,
                    "education": education,
                    "location": location
                })
            st.markdown("---")
        
        # Update session state with non-empty entries
        if updated_decision_makers:
            st.session_state.decision_makers = updated_decision_makers
    
    # NEW: Influencers section (similar to Decision Makers)
    st.subheader("Decision Influencers")
    influencers_container = st.container()
    
    if "influencers" not in st.session_state:
        st.session_state.influencers = [{
            "name": "", "position": "", "linkedin_url": "", 
            "education": [], "location": ""
        }]
    
    # Button to add more influencers
    if st.button("Add Influencer"):
        st.session_state.influencers.append({
            "name": "", "position": "", "linkedin_url": "", 
            "education": [], "location": ""
        })
    
    # Display influencer fields
    with influencers_container:
        updated_influencers = []
        for i, inf in enumerate(st.session_state.influencers):
            st.markdown(f"##### Influencer {i+1}")
            col1, col2 = st.columns(2)
            with col1:
                name = st.text_input(f"Name {i+1}", value=inf["name"], key=f"inf_name_{i}")
                position = st.text_input(f"Position {i+1}", value=inf["position"], key=f"inf_position_{i}")
            with col2:
                linkedin = st.text_input(f"LinkedIn URL {i+1}", value=inf["linkedin_url"], key=f"inf_linkedin_{i}")
                location = st.text_input(f"Location {i+1}", value=inf["location"], key=f"inf_location_{i}")
            
            edu_input = st.text_input(f"Education {i+1} (comma separated)", 
                                     key=f"inf_edu_{i}")
            education = [e.strip() for e in edu_input.split(',')] if edu_input else []
            
            if name or position or linkedin or location or education:
                updated_influencers.append({
                    "name": name,
                    "position": position,
                    "linkedin_url": linkedin,
                    "education": education,
                    "location": location
                })
            st.markdown("---")
        
        # Update session state
        if updated_influencers:
            st.session_state.influencers = updated_influencers
    
    # NEW: Hiring Trends section
    st.subheader("Hiring Trends")
    hiring_trends_container = st.container()
    
    if "hiring_trends" not in st.session_state:
        st.session_state.hiring_trends = [{"title": "", "description": ""}]
    
    # Button to add more hiring trends
    if st.button("Add Hiring Trend"):
        st.session_state.hiring_trends.append({"title": "", "description": ""})
    
    # Display hiring trend fields
    with hiring_trends_container:
        updated_hiring_trends = []
        for i, trend in enumerate(st.session_state.hiring_trends):
            st.markdown(f"##### Hiring Trend {i+1}")
            title = st.text_input(f"Job Title {i+1}", value=trend["title"], key=f"ht_title_{i}")
            description = st.text_area(f"Description {i+1}", value=trend["description"], key=f"ht_desc_{i}", height=80)
            
            if title or description:
                updated_hiring_trends.append({
                    "title": title,
                    "description": description
                })
            st.markdown("---")
        
        # Update session state
        if updated_hiring_trends:
            st.session_state.hiring_trends = updated_hiring_trends
    
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
                # Create enhanced payload with all parameters
                user_work_experience = [exp for exp in st.session_state.work_experiences 
                                      if exp["company"] or exp["title"]]
                
                payload = {
                    "companyName": company_name,
                    "targetGeography": location if location else None,
                    "businessType": business_type if business_type else None,
                    "industry": industry if industry else None,
                    "domain": domain if domain else None,
                    "userProfile": {
                        "name": user_name,
                        "businessType": user_business_type,
                        "industry": user_industry,
                        "role": user_role,
                        "location": user_location,
                        "company": user_company,
                        "education": user_education,
                        "previousEmployers": user_previous_employers,
                        "workExperience": user_work_experience,
                        "sellerOfferings": seller_offerings,
                        "productDescription": user_product_description
                    },
                    "technologies_used": tech_stack,
                    "keywords": keywords,
                    "decison_makers": [dm for dm in st.session_state.decision_makers 
                                      if dm["name"] or dm["position"]],
                    "decison_influencers": [inf for inf in st.session_state.influencers 
                                          if inf["name"] or inf["position"]],
                    "hiring_trends": [trend for trend in st.session_state.hiring_trends 
                                     if trend["title"] or trend["description"]]
                }
                
                # Remove None values
                payload = {k: v for k, v in payload.items() if v is not None}
                
                # Select the appropriate endpoint based on user choice
                endpoint = "generateExaSalesStrategy" if data_source == "Exa.ai (Web Search)" else "generateSalesStrategy"
                
                # Add more detailed timeout and error handling
                response = api_call(endpoint, method="POST", data=payload, timeout=timeout)
                
                # Continue with the existing response handling code...
                if response is None:
                    st.error("Server is not responding. Please check if the backend is running.")
                    st.info("Make sure your backend server is running on: " + BASE_URL)
                elif response.status_code == 200:
                    # Rest of the existing code to process and display the response...
                    result = response.json()
                    
                    # Display the results
                    st.success("Sales strategy generated successfully!")
                    
                    # Company overview section
                    st.header(f"{result.get('companyName', 'Company')} Sales Strategy")

                    # NEW: Display common backgrounds found in the response
                    if 'salesStrategy' in result and 'strategicAdvantagePoints' in result['salesStrategy']:
                        strategic_points = result['salesStrategy']['strategicAdvantagePoints']
                        if 'commonBackgrounds' in strategic_points and strategic_points['commonBackgrounds']:
                            st.subheader("💼 Common Backgrounds")
                            st.markdown('<div class="strategy-section">', unsafe_allow_html=True)
                            st.markdown(strategic_points['commonBackgrounds'])
                            st.markdown('</div>', unsafe_allow_html=True)
                    
                    # Continue with existing display code...
                    
                    # Raw JSON option
                    with st.expander("View raw JSON data"):
                        st.json(result)
                        
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
        st.session_state.messages = {}  # Dict to store messages by company
    
    if 'company' not in st.session_state:
        st.session_state.company = ""
        
    if 'company_data' not in st.session_state:
        st.session_state.company_data = None
    
    # NEW: Store user profile data in session state
    if 'user_profile_data' not in st.session_state:
        st.session_state.user_profile_data = {
            "name": "",
            "businessType": "",
            "industry": "",
            "role": "",
            "location": "",
            "company": "",
            "education": [],
            "previousEmployers": [],
            "workExperience": []
        }
    
    if 'user_context_data' not in st.session_state:
        st.session_state.user_context_data = {
            "productDescription": "",
            "sellerOfferings": []
        }
        
    if 'user_id' not in st.session_state:
        import uuid
        st.session_state.user_id = str(uuid.uuid4())
        
    if 'is_thinking' not in st.session_state:
        st.session_state.is_thinking = False
    
    # Create tab layout for different input methods
    setup_tabs = st.tabs(["Quick Setup", "Profile Setup", "Advanced Setup", "JSON Import"])
    
    with setup_tabs[0]:  # Quick Setup
        # Basic company input for quick setup
        st.subheader("Target Company Setup")
        
        col1, col2 = st.columns([2, 1])
        with col1:
            company_input = st.text_input(
                "Company Name",
                value=st.session_state.company,
                placeholder="Enter company name (e.g., Google, Microsoft)"
            )
        
        with col2:
            user_id_input = st.text_input(
                "User ID (optional)",
                value=st.session_state.user_id,
                help="A unique identifier for your conversation history"
            )
            if user_id_input:
                st.session_state.user_id = user_id_input
        
        use_exa = st.checkbox("Use web search for company information", value=True)
        
        if st.button("Set Company", key="set_company_quick"):
            if company_input:
                st.session_state.company = company_input
                with st.spinner(f"🔍 Gathering information about {company_input}..."):
                    payload = {
                        "company": company_input,
                        "useExaAi": use_exa,
                        "userId": st.session_state.user_id
                    }
                    
                    response = api_call("salesCoPilot/companyInfo", method="POST", data=payload, timeout=90)
                    
                    if response and response.status_code == 200:
                        result = response.json()
                        primary_data = result.get("primarySource", {}).get("data", {})
                        exa_data = result.get("exaSource", {}).get("data", {}) if result.get("exaSource") else {}
                        combined_data = {**exa_data, **primary_data} if exa_data else primary_data
                        
                        if combined_data and len(combined_data) > 0:
                            st.session_state.company_data = combined_data
                            st.success(f"✅ Found information about {company_input}")
                        else:
                            st.warning(f"Limited information found for {company_input}")
                            
                        if company_input not in st.session_state.messages:
                            st.session_state.messages[company_input] = []
                        
                        st.rerun()
                    else:
                        st.error("Error retrieving company information")
            else:
                st.error("Please enter a company name")
    
    with setup_tabs[1]:  # NEW: Profile Setup Tab
        st.subheader("Your Professional Profile")
        
        profile_col1, profile_col2 = st.columns(2)
        with profile_col1:
            user_name = st.text_input("Your Name", value=st.session_state.user_profile_data["name"])
            user_company = st.text_input("Your Company", value=st.session_state.user_profile_data["company"])
            user_location = st.text_input("Your Location", value=st.session_state.user_profile_data["location"])
        
        with profile_col2:
            user_role = st.text_input("Your Role", value=st.session_state.user_profile_data["role"])
            user_business_type = st.selectbox(
                "Business Type", 
                options=["Service", "Product", "IT Services", "Cloud Solutions", "Consulting", "Software"],
                index=0 if not st.session_state.user_profile_data["businessType"] else 
                      ["Service", "Product", "IT Services", "Cloud Solutions", "Consulting", "Software"].index(
                          st.session_state.user_profile_data["businessType"])
            )
            user_industry = st.text_input("Your Industry", value=st.session_state.user_profile_data["industry"])
        
        # Education and work history
        st.subheader("Education & Work History")
        col1, col2 = st.columns(2)
        
        with col1:
            education_input = st.text_area(
                "Education (one institution per line)", 
                value="\n".join(st.session_state.user_profile_data["education"])
            )
        
        with col2:
            employers_input = st.text_area(
                "Previous Employers (one per line)",
                value="\n".join(st.session_state.user_profile_data["previousEmployers"])
            )
        
        # Work experience container
        st.subheader("Work Experience Details")
        
        if "temp_work_exp" not in st.session_state:
            st.session_state.temp_work_exp = st.session_state.user_profile_data["workExperience"] if \
                st.session_state.user_profile_data["workExperience"] else [{"company": "", "title": "", "years": "", "description": ""}]
        
        # Button to add more work experience
        if st.button("Add Work Experience Entry"):
            st.session_state.temp_work_exp.append({"company": "", "title": "", "years": "", "description": ""})
        
        # Display work experience entries
        updated_work_exp = []
        for i, exp in enumerate(st.session_state.temp_work_exp):
            with st.expander(f"Work Experience {i+1}", expanded=i==0):
                col1, col2 = st.columns(2)
                with col1:
                    company = st.text_input(f"Company {i+1}", value=exp.get("company", ""), key=f"prof_company_{i}")
                    title = st.text_input(f"Title/Role {i+1}", value=exp.get("title", ""), key=f"prof_title_{i}")
                with col2:
                    years = st.text_input(f"Years {i+1}", value=exp.get("years", ""), key=f"prof_years_{i}")
                    description = st.text_area(f"Description {i+1}", value=exp.get("description", ""), key=f"prof_desc_{i}", height=100)
                
                if company or title:
                    updated_work_exp.append({
                        "company": company,
                        "title": title,
                        "years": years,
                        "description": description
                    })
        
        # Your product/service section
        st.subheader("Your Product/Service")
        product_desc = st.text_area(
            "Product/Service Description", 
            value=st.session_state.user_context_data["productDescription"],
            height=100
        )
        
        offerings_input = st.text_area(
            "Key Offerings (one per line)",
            value="\n".join(st.session_state.user_context_data["sellerOfferings"]),
            height=100
        )
        
        # Save profile button
        if st.button("Save Profile", type="primary"):
            # Update session state with all profile information
            st.session_state.user_profile_data = {
                "name": user_name,
                "businessType": user_business_type,
                "industry": user_industry,
                "role": user_role,
                "location": user_location,
                "company": user_company,
                "education": [e for e in education_input.split('\n') if e.strip()],
                "previousEmployers": [e for e in employers_input.split('\n') if e.strip()],
                "workExperience": updated_work_exp
            }
            
            st.session_state.user_context_data = {
                "productDescription": product_desc,
                "sellerOfferings": [o for o in offerings_input.split('\n') if o.strip()]
            }
            
            st.session_state.temp_work_exp = updated_work_exp
            
            st.success("✅ Profile saved successfully!")
    
    with setup_tabs[2]:  # Advanced Setup
        st.subheader("Detailed Company & User Setup")
        
        col1, col2, col3 = st.columns([3, 2, 2])
        with col1:
            adv_company_input = st.text_input(
                "Company Name",
                value=st.session_state.company,
                placeholder="Enter company name",
                key="adv_company"
            )
        
        with col2:
            location_input = st.text_input(
                "Location",
                placeholder="e.g., United States, India"
            )
        
        with col3:
            industry_input = st.text_input(
                "Industry",
                placeholder="e.g., Technology, Healthcare"
            )
        
        # User profile expandable section
        with st.expander("Your Profile & Solution", expanded=True):
            user_profile_col1, user_profile_col2 = st.columns(2)
            
            with user_profile_col1:
                user_name = st.text_input("Your Name", key="copilot_name")
                user_company = st.text_input("Your Company", key="copilot_company")
                user_location = st.text_input("Your Location", key="copilot_location")
            
            with user_profile_col2:
                user_role = st.text_input("Your Role", key="copilot_role")
                user_business_type = st.selectbox("Business Type", options=["Service", "Product"], key="copilot_business_type")
                user_industry = st.text_input("Your Industry", key="copilot_industry")
            
            user_product_description = st.text_area("Describe your product/service", key="copilot_product_desc")
        
        # Advanced setup button
        if st.button("Set Company", key="set_company_adv"):
            if adv_company_input:
                st.session_state.company = adv_company_input
                with st.spinner(f"🔍 Gathering information about {adv_company_input}..."):
                    # Similar API call logic as quick setup, but with more parameters
                    payload = {
                        "company": adv_company_input,
                        "useExaAi": True,
                        "userId": st.session_state.user_id,
                        "companyData": {
                            "industry": industry_input,
                            "headquarters": location_input
                        }
                    }
                    
                    response = api_call("salesCoPilot/companyInfo", method="POST", data=payload, timeout=90)
                    
                    if response and response.status_code == 200:
                        # Similar response handling as quick setup
                        result = response.json()
                        primary_data = result.get("primarySource", {}).get("data", {})
                        exa_data = result.get("exaSource", {}).get("data", {}) if result.get("exaSource") else {}
                        combined_data = {**exa_data, **primary_data} if exa_data else primary_data
                        
                        if combined_data and len(combined_data) > 0:
                            st.session_state.company_data = combined_data
                            st.success(f"✅ Found information about {adv_company_input}")
                        else:
                            st.warning(f"Limited information found for {adv_company_input}")
                            
                        if adv_company_input not in st.session_state.messages:
                            st.session_state.messages[adv_company_input] = []
                        
                        st.rerun()
                    else:
                        st.error("Error retrieving company information")
            else:
                st.error("Please enter a company name")
    
    with setup_tabs[3]:  # JSON Import
        st.subheader("Import Company Data from JSON")
        
        # Input for company name and JSON data
        json_company_input = st.text_input(
            "Company Name",
            placeholder="Enter company name",
            key="json_company"
        )
        
        json_data = st.text_area(
            "Paste Company JSON Data",
            placeholder='{"industry": "Technology", "businessType": "Software", "headquarters": "California", ...}',
            height=300
        )
        
        # Button to parse and set JSON data
        if st.button("Import JSON Data"):
            if json_company_input and json_data:
                try:
                    # Parse JSON data
                    import json
                    parsed_data = json.loads(json_data)
                    
                    # Set company and data
                    st.session_state.company = json_company_input
                    st.session_state.company_data = parsed_data
                    
                    # Initialize messages
                    if json_company_input not in st.session_state.messages:
                        st.session_state.messages[json_company_input] = []
                    
                    st.success(f"✅ Successfully imported data for {json_company_input}")
                    st.rerun()
                except json.JSONDecodeError:
                    st.error("Invalid JSON format. Please check your input.")
            else:
                st.error("Please enter both company name and JSON data")
    
    # Add a separator
    st.markdown("---")
    
    # Display chat interface if company is selected
    if st.session_state.company:
        company = st.session_state.company
        
        # Show company info header with a badge
        col1, col2 = st.columns([3, 1])
        with col1:
            st.markdown(f"### 💬 Chatting with: {company}")
        
        with col2:
            if st.button("Clear Chat", type="secondary"):
                if company in st.session_state.messages:
                    st.session_state.messages[company] = []
                    
                    # Also clear on server
                    api_call(
                        "salesCoPilot/clearHistory", 
                        method="POST", 
                        data={
                            "userId": st.session_state.user_id,
                            "company": company
                        }
                    )
                    
                    st.success("Conversation cleared!")
                    st.rerun()
        
        # Show company data card when available
        if st.session_state.company_data:
            with st.expander("📊 Company Information", expanded=False):
                company_data = st.session_state.company_data
                
                # Display company info in columns
                col1, col2, col3 = st.columns(3)
                with col1:
                    st.metric("Industry", company_data.get("industry", "Unknown"))
                with col2:
                    st.metric("Type", company_data.get("businessType", "Unknown"))
                with col3:
                    st.metric("Location", company_data.get("headquarters", "Unknown"))
                
                # Display products/services
                if "productOrServiceDetails" in company_data and company_data["productOrServiceDetails"]:
                    st.subheader("Products & Services")
                    for product in company_data["productOrServiceDetails"]:
                        st.markdown(f"• {product}")
                
                # FIXED: Instead of nested expander, just add a button to toggle JSON view
                if st.button("View Raw JSON Data", key="view_company_json"):
                    st.json(company_data)
        
        # Show user profile summary if available
        if any(st.session_state.user_profile_data.values()):
            with st.expander("👤 Your Profile Information", expanded=False):
                profile = st.session_state.user_profile_data
                context = st.session_state.user_context_data
                
                st.markdown(f"**Name**: {profile['name']}")
                st.markdown(f"**Company**: {profile['company']}")
                st.markdown(f"**Role**: {profile['role']}")
                
                if profile['education']:
                    st.markdown("**Education:**")
                    for edu in profile['education']:
                        st.markdown(f"• {edu}")
                
                if profile['previousEmployers']:
                    st.markdown("**Previous Employers:**")
                    for emp in profile['previousEmployers']:
                        st.markdown(f"• {emp}")
                
                if context['sellerOfferings']:
                    st.markdown("**Key Offerings:**")
                    for off in context['sellerOfferings']:
                        st.markdown(f"• {off}")
        
        # Chat container and styling - keep your existing code
        # ...
        
        # Chat message container with fixed height
        st.markdown("""
        <style>
        .chat-container {
            border: 1px solid #e6e6e6;
            border-radius: 10px;
            padding: 15px;
            max-height: 400px;
            overflow-y: auto;
            margin-bottom: 20px;
            background-color: #f9f9f9;
        }
        .stChatMessage [data-testid="stVerticalBlock"] {
            border: 1px solid #e0e0e0;
            border-radius: 10px;
            padding: 10px;
            margin-bottom: 10px;
        }
        .chat-bubble {
            padding: 10px 15px;
            border-radius: 15px;
            margin-bottom: 10px;
            max-width: 80%;
            animation: fadeIn 0.3s ease-in;
        }
        .user-bubble {
            background-color: #e9f3ff;
            border: 1px solid #c2e0ff;
            margin-left: auto;
            text-align: right;
        }
        .assistant-bubble {
            background-color: #f0f0f0;
            border: 1px solid #e0e0e0;
            margin-right: auto;
        }
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .thinking-dots {
            display: inline-block;
            animation: pulseAnimation 1.2s infinite;
        }
        @keyframes pulseAnimation {
            0% { opacity: 0.5; }
            50% { opacity: 1; }
            100% { opacity: 0.5; }
        }
        </style>
        """, unsafe_allow_html=True)
        
        chat_container = st.container()
        with chat_container:
            st.markdown('<div class="chat-container">', unsafe_allow_html=True)
            if company in st.session_state.messages:
                for message in st.session_state.messages[company]:
                    if message["role"] == "user":
                        st.chat_message("user").write(message["content"])
                    else:
                        st.chat_message("assistant").write(message["content"])
            
            # Thinking animation
            if st.session_state.is_thinking:
                with st.chat_message("assistant"):
                    st.markdown('<div class="thinking-dots">Thinking...</div>', unsafe_allow_html=True)
            
            st.markdown('</div>', unsafe_allow_html=True)
        
        # Follow-up container for suggestions
        suggestion_container = st.container()
        
        # Chat input
        prompt = st.chat_input(f"Ask about {company}...")
        
        if prompt:
            # Reset thinking state
            st.session_state.is_thinking = True
            
            # Add to session
            if company not in st.session_state.messages:
                st.session_state.messages[company] = []
                
            st.session_state.messages[company].append({"role": "user", "content": prompt})
            
            # Show in chat immediately
            st.rerun()  # This will show the message and the thinking animation
        
        # If we just set thinking to true, handle the API call
        if st.session_state.is_thinking and company in st.session_state.messages and len(st.session_state.messages[company]) > 0:
            last_msg = st.session_state.messages[company][-1]
            
            # Only process if the last message was from the user and we haven't processed it yet
            if last_msg["role"] == "user" and not any(msg.get("processing") for msg in st.session_state.messages[company]):
                # Mark as processing to prevent duplicate calls
                st.session_state.messages[company][-1]["processing"] = True
                
                # Prepare context from company data
                company_context = ""
                if st.session_state.company_data:
                    data = st.session_state.company_data
                    company_context = f"""
                    Company: {company}
                    Industry: {data.get('industry', 'Unknown')}
                    Business Type: {data.get('businessType', 'Unknown')}
                    Location: {data.get('headquarters', 'Unknown')}
                    """
                    
                    if "productOrServiceDetails" in data:
                        products = ", ".join(data["productOrServiceDetails"][:5])
                        company_context += f"Products/Services: {products}\n"
                    
                    if "painPoints" in data:
                        pain_points = ", ".join(data["painPoints"][:5])
                        company_context += f"Pain Points: {pain_points}\n"
                
                # Call API without showing spinner (we already have animation)
                try:
                    # NEW: Include stored user profile in every request
                    payload = {
                        "company": company,
                        "query": last_msg["content"],
                        "userId": st.session_state.user_id,
                        "user_data": [company_context] if company_context else [],
                        "userProfile": st.session_state.user_profile_data,
                        "userContext": st.session_state.user_context_data,
                        "companyData": st.session_state.company_data
                    }
                    
                    response = api_call("salesCoPilot", method="POST", data=payload, timeout=60)
                    
                    # Turn off thinking animation
                    st.session_state.is_thinking = False
                    
                    if response and response.status_code == 200:
                        result = response.json()
                        ai_response = result.get("response", "I couldn't process your request.")
                        
                        # Add to session and display
                        st.session_state.messages[company].append({"role": "assistant", "content": ai_response})
                        
                        # Save follow-up questions if any
                        follow_up_questions = result.get("followUpQuestions", [])
                        if follow_up_questions:
                            st.session_state.followups = follow_up_questions
                        else:
                            st.session_state.followups = []
                    else:
                        error_msg = "Sorry, I encountered an error processing your request."
                        st.session_state.messages[company].append({"role": "assistant", "content": error_msg})
                        st.session_state.followups = []
                    
                    # Update the display
                    st.rerun()
                except Exception as e:
                    # Handle errors
                    st.session_state.is_thinking = False
                    error_msg = f"Sorry, an error occurred: {str(e)}"
                    st.session_state.messages[company].append({"role": "assistant", "content": error_msg})
                    st.rerun()
        
        # Display follow-up questions if available
        if hasattr(st.session_state, 'followups') and st.session_state.followups:
            with suggestion_container:
                st.markdown("##### Suggested follow-up questions:")
                cols = st.columns(min(len(st.session_state.followups), 3))
                
                for i, question in enumerate(st.session_state.followups[:3]):  # Limit to 3
                    with cols[i % 3]:
                        if st.button(question, key=f"suggestion_{i}_{company}"):
                            # Add question to chat as if user typed it
                            if company not in st.session_state.messages:
                                st.session_state.messages[company] = []
                            
                            st.session_state.messages[company].append({"role": "user", "content": question})
                            st.session_state.is_thinking = True
                            st.rerun()
else:
    st.title("Welcome to SalesGPT API Client")
    st.write("Please select an API from the sidebar to get started.")
    
    st.info("This tool provides interfaces for:")
    col1, col2 = st.columns(2)
    with col1:
        st.markdown("• **Generate Sales Strategy**: Create personalized sales approaches")
        st.markdown("• **Document Management**: Upload and manage your sales documents")
    with col2:
        st.markdown("• **LinkedIn Profiles**: Find relevant prospects")
        st.markdown("• **Sales Co-Pilot**: Chat with AI about target accounts")

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