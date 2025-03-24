const axios = require('axios');
const aiService = require('../services/aiService');

/**
 * Generates a comprehensive sales strategy for a target company
 */
const generateSalesStrategy = async (req, res) => {
  try {
    // Extract parameters from request
    const { companyName, targetGeography, businessType, industry, role } = req.body;
    
    if (!companyName) {
      return res.status(400).json({
        success: false,
        message: 'Company name is required'
      });
    }
    
    console.log(`🔍 Generating sales strategy for ${companyName}`);
    
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
    
    // Step 2: Prepare data for the AI service
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
      role: organizationData?.role || role || "Unknown"
    };
    
    // Step 3: Generate sales strategy using AI
    const prompt = createSalesStrategyPrompt(companyProfile, errorDetails);
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
    
    // Step 4: Return the complete response
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
 * Create the prompt for the AI service to generate a sales strategy
 */
function createSalesStrategyPrompt(companyProfile, errorDetails) {
  return `
    Generate a comprehensive sales strategy for ${companyProfile.name}.
    
    COMPANY INFORMATION:
    ${JSON.stringify(companyProfile, null, 2)}
    
    ${errorDetails ? `NOTE: There was an issue retrieving complete company data: ${errorDetails.message}
    If you know information about this company, please include it in your response.` : ''}
    
    Please generate a complete sales strategy in the following JSON format:
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
        "competitorAnalysis": [
          {
            "competitor": "Competitor Name",
            "strengths": ["...", "..."],
            "weaknesses": ["...", "..."]
          }
        ],
        "ccsScore": 85
      }
    }
    
    Include a "ccsScore" (Customer Compatibility Score) between 0-100 that reflects how well this company would align with our services.
    
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