const exaSearchService = require('../services/exaSearchService');
const aiService = require('../services/aiService');

/**
 * Generates a comprehensive sales strategy for a target company using Exa.ai
 */
const generateExaSalesStrategy = async (req, res) => {
  try {
    // Extract parameters from request
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
    
    console.log(`🔍 Generating Exa-powered sales strategy for ${companyName} for ${userProfile.name || 'user'}`);
    
    // Step 1: Gather company information from Exa.ai
    let companyProfile = null;
    let errorDetails = null;
    
    try {
      companyProfile = await exaSearchService.searchCompanyInfo(companyName, {
        targetGeography, 
        businessType, 
        industry, 
        role
      });
      
      console.log(`✅ Successfully retrieved information for ${companyName} from Exa.ai`);
    } catch (error) {
      errorDetails = {
        type: 'search_failed',
        message: `Error retrieving information from Exa.ai: ${error.message}`,
        details: error
      };
      console.error(`❌ ${errorDetails.message}`);
      
      // Create a minimal company profile with the available information
      companyProfile = {
        name: companyName,
        industry: industry || "Technology",
        businessType: businessType || "Services",
        headquarters: targetGeography || "Unknown",
        companySize: {
          employeeCount: "Unknown",
          annualRevenue: "Unknown"
        },
        productOrServiceDetails: ["Information not available"],
        techStack: ["Information not available"],
        painPoints: ["Information not available"],
        competitors: ["Information not available"]
      };
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
    
    // Add common connections to company profile
    companyProfile.commonConnections = commonConnections;
    
    // Step 3: Generate sales strategy using AI
    const prompt = createSalesStrategyPrompt(companyProfile, errorDetails, userContext, userProfile);
    console.log("🧠 Sending Exa.ai data to AI service for strategy generation");
    
    let salesStrategy = null;
    try {
      const aiResponse = await aiService.generateContent(prompt);
      salesStrategy = parseAIResponse(aiResponse, companyProfile);
      console.log("✅ Successfully generated Exa-powered sales strategy");
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
    
    // Step 3: Return the complete response
    return res.status(200).json({
      success: true,
      ...salesStrategy,
      errors: errorDetails ? {
        companyError: errorDetails.message,
        usingFallback: errorDetails.type === 'search_failed'
      } : null
    });
    
  } catch (error) {
    console.error('Error in generateExaSalesStrategy:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while generating Exa-powered sales strategy',
      error: error.message
    });
  }
};

/**
 * Find common connections between user and target company
 */
async function findCommonConnections(userProfile, companyName) {
  try {
    // This would be implemented using your LinkedinService or similar
    // Placeholder implementation - replace with actual API call
    return [];
  } catch (error) {
    console.error(`Error finding common connections: ${error}`);
    return [];
  }
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
    
    COMPANY INFORMATION:
    Name: ${companyProfile.name}
    Industry: ${companyProfile.industry}
    Business Type: ${companyProfile.businessType}
    Headquarters: ${companyProfile.headquarters}
    Employee Count: ${companyProfile.companySize.employeeCount}
    Annual Revenue: ${companyProfile.companySize.annualRevenue}
    
    PRODUCTS/SERVICES:
    ${companyProfile.productOrServiceDetails.map(p => `- ${p}`).join('\n')}
    
    TECHNOLOGY STACK:
    ${companyProfile.techStack.map(t => `- ${t}`).join('\n')}
    
    PAIN POINTS:
    ${companyProfile.painPoints.map(p => `- ${p}`).join('\n')}
    
    COMPETITORS:
    ${companyProfile.competitors.map(c => `- ${c}`).join('\n')}
    
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
  generateExaSalesStrategy
};