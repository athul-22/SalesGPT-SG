const axios = require('axios');
const aiService = require('../services/aiService');

/**
 * Generates a comprehensive sales strategy for a target company
 */
const generateSalesStrategy = async (req, res) => {
  try {
    // Extract target company parameters
    const { companyName, targetGeography, businessType, industry, role } = req.body;
    
    // Extract new user context parameters
    const { 
      userContext = {}, // New parameter for user's business context
      userProfile = {} // New parameter for user's profile information
    } = req.body;
    
    if (!companyName) {
      return res.status(400).json({
        success: false,
        message: 'Company name is required'
      });
    }
    
    console.log(`🔍 Generating sales strategy for ${companyName} for ${userProfile.name || 'user'}`);
    
    // Step 1: Search for organization details
    let organizationData = null;
    let errorDetails = null;
    
    try {
      // Search for the organization
      const searchResult = await searchOrganization(companyName, {
        targetGeography, 
        businessType, 
        industry, 
        role
      });
      
      // Check if we found any organizations
      if (searchResult && Array.isArray(searchResult) && searchResult.length > 0) {
        // Find best match (exact match if possible)
        const exactMatch = searchResult.find(org => 
          org.name && org.name.toLowerCase() === companyName.toLowerCase()
        );
        
        const selectedOrg = exactMatch || searchResult[0];
        console.log(`✅ Found organization: ${selectedOrg.name} (ID: ${selectedOrg.id})`);
        
        // Get detailed organization information
        organizationData = await getOrganizationDetails(selectedOrg.id);
      } else {
        errorDetails = {
          type: 'search_failed',
          message: `No organizations found matching "${companyName}"`
        };
        console.warn(`⚠️ ${errorDetails.message}`);
      }
    } catch (error) {
      errorDetails = {
        type: 'api_error',
        message: `Error searching for organization: ${error.message}`,
        details: error.response?.data || error.message
      };
      console.error(`❌ ${errorDetails.message}`);
    }
    
    // Step 2: Find common connections (if LinkedIn data is available)
    let commonConnections = [];
    try {
      if (userProfile.name) {
        const connections = await findCommonConnections(userProfile, companyName);
        commonConnections = connections || [];
        console.log(`✅ Found ${commonConnections.length} common connections`);
      }
    } catch (connectionError) {
      console.error(`❌ Error finding common connections: ${connectionError.message}`);
    }
    
    // Step 3: Prepare data for the AI service
    const companyProfile = {
      name: organizationData?.name || companyName,
      industry: organizationData?.industry || industry || "Technology",
      businessType: organizationData?.businessType || businessType || "Services",
      location: organizationData?.targetGeography || targetGeography || "Unknown",
      companySize: {
        annualRevenue: organizationData?.annualRevenue || "Unknown",
        employeeCount: organizationData?.employeeCount || "Unknown"
      },
      products: organizationData?.products || [],
      description: organizationData?.description || `A company named ${companyName}`,
      role: organizationData?.role || role || "Unknown",
      commonConnections: commonConnections
    };
    
    // Step 4: Generate sales strategy using AI with user context
    const prompt = createSalesStrategyPrompt(companyProfile, errorDetails, userContext, userProfile);
    console.log("🧠 Sending data to AI service for strategy generation");
    
    let salesStrategy = null;
    try {
      const aiResponse = await aiService.generateContent(prompt);
      salesStrategy = parseAIResponse(aiResponse, companyProfile);
      console.log("✅ Successfully generated sales strategy");
    } catch (aiError) {
      console.error(`❌ Error generating AI strategy: ${aiError.message}`);
      
      // Return a basic response with error information
      return res.status(200).json({
        success: false,
        companyName: companyProfile.name,
        industry: companyProfile.industry,
        businessType: companyProfile.businessType,
        errors: {
          companyError: errorDetails?.message || "Unknown error occurred",
          aiError: aiError.message,
          usingFallback: true
        },
        message: "Failed to generate complete sales strategy"
      });
    }
    
    // Step 5: Return the complete response
    return res.status(200).json({
      success: true,
      ...salesStrategy,
      errors: errorDetails ? {
        companyError: errorDetails.message,
        usingFallback: errorDetails.type === 'search_failed'
      } : null
    });
    
  } catch (error) {
    console.error('Error in generateSalesStrategy:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while generating sales strategy',
      error: error.message
    });
  }
};

/**
 * Search for an organization by name and other criteria
 */
async function searchOrganization(companyName, options = {}) {
  try {
    // Build query parameters
    const params = { companyName };
    
    // Add optional parameters if they exist
    if (options.targetGeography) params.targetGeography = options.targetGeography;
    if (options.businessType) params.businessType = options.businessType;
    if (options.industry) params.industry = options.industry;
    if (options.role) params.role = options.role;
    
    console.log(`🌐 Searching for "${companyName}" at external API`);
    
    // Get the API token from environment variables
    const apiToken = process.env.ORGANIZATION_API_TOKEN;
    
    if (!apiToken) {
      console.warn('⚠️ API token is missing in .env file');
    }
    
    // Make the API request
    const response = await axios({
      method: 'GET',
      url: `${process.env.ORGANIZATION_API_URL || 'http://13.235.243.0:3001'}/v1/organizations`,
      params,
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Accept': 'application/json'
      },
      timeout: 10000 
    });
    
    return response.data;
  } catch (error) {
    console.error(`❌ Error searching organizations: ${error.message}`);
    
    // Log detailed error information
    if (error.response) {
      console.error(`🔴 Response status: ${error.response.status}`);
      console.error(`🔴 Response data:`, error.response.data);
    } else if (error.request) {
      console.error(`🔴 No response received from API`);
    }
    
    throw error;
  }
}

/**
 * Get detailed information about an organization by ID
 */
async function getOrganizationDetails(companyId) {
  try {
    console.log(`🔍 Getting details for organization ID: ${companyId}`);
    
    // Get the API token from environment variables
    const apiToken = process.env.ORGANIZATION_API_TOKEN;
    
    // Make the API request
    const response = await axios({
      method: 'GET',
      url: `${process.env.ORGANIZATION_API_URL || 'http://13.235.243.0:3001'}/v1/organization`,
      params: { companyId },
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Accept': 'application/json'
      },
      timeout: 10000 // 10-second timeout
    });
    
    console.log(`✅ Successfully retrieved organization details`);
    return response.data;
  } catch (error) {
    console.error(`❌ Error getting organization details: ${error.message}`);
    
    // Log detailed error information
    if (error.response) {
      console.error(`🔴 Response status: ${error.response.status}`);
      console.error(`🔴 Response data:`, error.response.data);
    }
    
    throw error;
  }
}

/**
 * Find common connections between user and target company
 */
async function findCommonConnections(userProfile, companyName) {
  try {
    // Use Rapid API to find connections
    const apiKey = process.env.RAPID_API_KEY;
    const apiHost = process.env.RAPID_API_HOST;
    
    // Example implementation - replace with actual API call
    const response = await axios({
      method: 'GET',
      url: `https://${apiHost}/search-organization-contacts`,
      params: {
        name: companyName,
        page: 1
      },
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': apiHost
      }
    });
    
    // Process connections data to find common history
    const contacts = response.data?.contacts || [];
    return contacts.filter(contact => {
      // Check for common education or work history
      return hasCommonBackground(userProfile, contact);
    });
  } catch (error) {
    console.error(`Error finding common connections: ${error}`);
    return [];
  }
}

/**
 * Check if user has common background with contact
 */
function hasCommonBackground(userProfile, contact) {
  // Implement logic to check common education or work history
  // This is a placeholder for the actual implementation
  return false;
}

/**
 * Create the prompt for the AI service to generate a sales strategy
 */
function createSalesStrategyPrompt(companyProfile, errorDetails, userContext, userProfile) {
  return `
    Generate a comprehensive sales strategy for a ${userProfile.businessType || ''} business in the ${userProfile.industry || 'technology'} industry targeting ${companyProfile.name}.
    
    SALES REPRESENTATIVE PROFILE:
    Name: ${userProfile.name || 'Sales Representative'}
    Role: ${userProfile.role || 'Sales Professional'}
    Company: ${userProfile.company || 'Our Company'}
    Business Type: ${userProfile.businessType || 'Service/Product Provider'}
    Industry Focus: ${userProfile.industry || 'Technology Solutions'}
    Location: ${userProfile.location || 'Global'}
    
    YOUR PRODUCT/SERVICE OFFERING:
    ${userContext.productDescription || 'A professional solution that helps organizations improve their operations and achieve their goals.'}
    
    TARGET COMPANY INFORMATION:
    ${JSON.stringify(companyProfile, null, 2)}
    
    ${companyProfile.commonConnections && companyProfile.commonConnections.length > 0 ? 
      `COMMON CONNECTIONS:\n${companyProfile.commonConnections.map(c => `- ${c.name}, ${c.title} (Common: ${c.commonBackground})`).join('\n')}` : 
      'No common connections found.'}
    
    ${errorDetails ? `NOTE: There was an issue retrieving complete company data: ${errorDetails.message}
    If you know information about this company, please include it in your response.` : ''}
    
    Please generate a complete sales strategy that specifically positions ${userProfile.company || 'our'} ${userProfile.businessType || ''} 
    solutions for ${companyProfile.name} in the following JSON format:
    {
      "companyName": "${companyProfile.name}",
      "industry": "...",
      "businessType": "...",
      "headquarters": "...",
      "companySize": {
        "annualRevenue": "...",
        "employeeCount": "..."
      },
      "productOrServiceDetails": [
        "Product/Service 1",
        "Product/Service 2"
      ],
      "salesStrategy": {
        "currentSituation": {
          "opportunitiesAndPriorities": "...",
          "existingTechnologySolutions": ["...", "..."],
          "painPointsAndMarketPressures": ["...", "..."]
        },
        "valueProposition": {
          "keyMessage": "...",
          "benefits": ["...", "..."],
          "differentiation": "..."
        },
        "relevanceToProspect": "Explain specifically how your ${userProfile.businessType || ''} solution addresses the target company's needs",
        "potentialObstaclesMitigation": {
          "obstacle1": {
            "description": "...",
            "mitigation": "..."
          },
          "obstacle2": {
            "description": "...",
            "mitigation": "..."
          }
        },
        "engagementStrategy": ["...", "..."],
        "keyDecisionMakers": [{
          "role": "...",
          "approachStrategy": "..."
        }],
        "competitorAnalysis": [
          {
            "competitor": "Competitor Name",
            "relevance": "Why this competitor is relevant (industry/size/location match)",
            "strengths": ["...", "..."],
            "weaknesses": ["...", "..."]
          }
        ],
        "commonConnectionLeverage": "How to leverage any common connections or background"
      }
    }
    
    Make the sales strategy highly specific to selling ${userProfile.businessType || ''} solutions from the ${userProfile.industry || ''} industry to this specific company.
    Focus on how your offering solves their particular problems and creates value for them.
    Make the competitors relevant to their industry, market location, company size and revenue.
    
    DO NOT wrap the response in markdown code blocks.
    Return ONLY a valid JSON object.
    Make sure all company information is accurate, and supplement with your knowledge if the provided data is incomplete.
  `;
}

/**
 * Parse and clean the AI response
 */
function parseAIResponse(aiResponse, companyProfile) {
  try {
    // Remove any markdown code fence markers and trim whitespace
    const cleanedResponse = aiResponse.replace(/```json|```/g, '').trim();
    
    // Parse the JSON response
    const parsedResponse = JSON.parse(cleanedResponse);
    
    // Make sure company name is correct
    if (!parsedResponse.companyName) {
      parsedResponse.companyName = companyProfile.name;
    }
    
    return parsedResponse;
  } catch (error) {
    console.error("Error parsing AI response:", error);
    
    // If parsing fails, return a basic structure with the raw response
    return {
      companyName: companyProfile.name,
      industry: companyProfile.industry,
      businessType: companyProfile.businessType,
      rawResponse: aiResponse
    };
  }
}

module.exports = {
  generateSalesStrategy
};