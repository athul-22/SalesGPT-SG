const https = require('https');
const organizationService = require('../services/organizationService');
const aiService = require('../services/aiService');

// Helper function to make HTTP requests with improved error handling
const makeRequest = (options) => {
    return new Promise((resolve, reject) => {
        console.log(`Making request to ${options.hostname}${options.path}...`);
        
        const request = https.request(options, (response) => {
            const chunks = [];
            
            response.on('data', (chunk) => chunks.push(chunk));
            
            response.on('end', () => {
                const body = Buffer.concat(chunks);
                
                // Check for non-200 status codes
                if (response.statusCode !== 200) {
                    return reject(new Error(`API returned status code ${response.statusCode}: ${body.toString()}`));
                }
                
                try {
                    const data = JSON.parse(body.toString());
                    console.log(`Successfully received response from ${options.hostname}${options.path}`);
                    resolve(data);
                } catch (error) {
                    console.error(`JSON parse error for ${options.hostname}${options.path}: ${error.message}`);
                    reject(new Error(`Failed to parse response: ${error.message}`));
                }
            });
        });
        
        // Set a timeout of 30 seconds
        request.setTimeout(30000, () => {
            request.abort();
            reject(new Error(`Request to ${options.hostname}${options.path} timed out`));
        });
        
        request.on('error', (error) => {
            console.error(`Request error for ${options.hostname}${options.path}: ${error.message}`);
            reject(error);
        });
        
        request.end();
    });
};

// Create a function to safely fetch from Apollo API with retries
const safeApiCall = async (options, retries = 2) => {
  try {
    return await makeRequest(options);
  } catch (error) {
    // If it's a parameter issue, try to fix it
    if (error.message.includes('missing in params') && options.path.includes('organization_id')) {
      console.log("Attempting to fix API parameter naming...");
      const newPath = options.path.replace('organization_id=', 'id=');
      const newOptions = { ...options, path: newPath };
      return await makeRequest(newOptions);
    }
    
    // If retries left, wait a bit and try again
    if (retries > 0) {
      console.log(`Retrying API call, ${retries} attempts left...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      return safeApiCall(options, retries - 1);
    }
    throw error;
  }
};

// Function to clean markdown formatting from AI responses
const cleanJsonResponse = (text) => {
    try {
        // Remove markdown code fence markers
        let cleaned = text.replace(/```(json|javascript)?|```/g, '');
        // Trim whitespace
        cleaned = cleaned.trim();
        return cleaned;
    } catch (error) {
        console.error("Error cleaning JSON response:", error);
        return text; // Return original text if cleaning fails
    }
};

// This function is executed when the sales strategy endpoint is hit
const generateSalesStrategy = async (req, res) => {
    try {
        // Get parameters from request body
        const companyName = req.body?.companyName || 'Google';
        const targetGeography = req.body?.targetGeography || '';
        const businessType = req.body?.businessType || '';
        const industry = req.body?.industry || '';
        const role = req.body?.role || '';
        
        console.log(`Searching for organization: ${companyName}`);

        // Create search options from request parameters
        const searchOptions = {
            targetGeography,
            businessType,
            industry,
            role
        };

        // Create a fallback response in case everything fails
        const fallbackResponse = {
            companyName: companyName,
            industry: industry || "Technology",
            businessType: businessType || "Services",
            companySize: {
                annualRevenue: "Unknown",
                employeeCount: "Unknown"
            },
            productOrServiceDetails: [
                "Product 1",
                "Service 1",
                "Solution 1"
            ],
            salesStrategy: {
                currentSituation: {
                    opportunitiesAndPriorities: "Digital transformation and innovation",
                    existingTechnologySolutions: ["Cloud Services", "Data Analytics", "AI Solutions"],
                    painPointsAndMarketPressures: ["Competitive market", "Scaling challenges", "Integration needs"]
                },
                valueProposition: {
                    keyMessage: `Our solution helps ${companyName} optimize operations and drive growth.`,
                    benefits: ["Improved efficiency", "Cost reduction", "Enhanced user experience"],
                    differentiation: "Unique combination of technology and service"
                },
                potentialObstaclesMitigation: {
                    obstacle1: {
                        description: "Budget constraints",
                        mitigation: "Flexible pricing and ROI calculation"
                    },
                    obstacle2: {
                        description: "Integration complexity",
                        mitigation: "Seamless API integration and support"
                    }
                },
                engagementStrategy: [
                    "Executive outreach",
                    "Industry-specific demos",
                    "Proof of concept"
                ],
                competitorAnalysis: [
                    {
                        competitor: "Competitor A",
                        strengths: ["Market share", "Brand recognition"],
                        weaknesses: ["High pricing", "Limited customization"]
                    },
                    {
                        competitor: "Competitor B",
                        strengths: ["Technology innovation", "User experience"],
                        weaknesses: ["Small market presence", "Limited support"]
                    }
                ],
                ccsScore: 82
            }
        };

        try {
            // Step 1: Search for organizations using the search API
            const organizations = await organizationService.searchOrganizations(companyName, searchOptions);
            
            if (!Array.isArray(organizations) || organizations.length === 0 || organizations.error) {
                console.log(`No organizations found for ${companyName}, using fallback`);
                return res.status(200).json(fallbackResponse);
            }

            // Log a sample of what the API is actually returning
            console.log('First organization structure:', JSON.stringify(organizations[0], null, 2));
            
            // Replace the section where we process the organizations array:

            // First, let's debug what we're actually getting from the API
            console.log('API Response Type:', typeof organizations);
            console.log('Is array?', Array.isArray(organizations));
            console.log('Length:', organizations.length);
            console.log('Full API Response:', JSON.stringify(organizations, null, 2));
            
            // Safely select the first organization
            let targetCompany = null;
            if (Array.isArray(organizations) && organizations.length > 0) {
                // Try to find an exact match by name
                targetCompany = organizations.find(org => 
                    org.name && companyName && 
                    org.name.toLowerCase() === companyName.toLowerCase()
                );
                
                // If not found, look for a partial match
                if (!targetCompany) {
                    targetCompany = organizations.find(org => 
                        org.name && companyName && 
                        org.name.toLowerCase().includes(companyName.toLowerCase())
                    );
                }
                
                // If still not found, just take the first result
                if (!targetCompany) {
                    targetCompany = organizations[0];
                }
                
                console.log('Selected organization:', JSON.stringify(targetCompany, null, 2));
            } else {
                console.error('No valid organizations found in the response');
                return res.status(200).json(fallbackResponse);
            }
            
            // Safely extract companyId
            const companyId = targetCompany.id;
            if (!companyId) {
                console.error('No company ID found in the selected organization');
                return res.status(200).json(fallbackResponse);
            }
            
            console.log(`Found company: ${targetCompany.name || 'Unknown'} (ID: ${companyId})`);

            // Step 2: Get detailed organization information and news
            let detailsResponse, newsResponse;
            
            try {
                [detailsResponse, newsResponse] = await Promise.all([
                    organizationService.getOrganizationDetails(companyId),
                    organizationService.getOrganizationNews(companyId)
                ]);
            } catch (error) {
                console.error("Error fetching organization details and news:", error);
                detailsResponse = targetCompany;
                newsResponse = [];
            }

            // Check for errors in responses
            const organizationDetails = detailsResponse.error ? targetCompany : detailsResponse;
            const organizationNews = Array.isArray(newsResponse) ? newsResponse : [];
            
            // Step 3: Create comprehensive company profile
            const companyProfile = {
                name: organizationDetails.name || companyName,
                industry: organizationDetails.industry || industry || "Technology",
                description: organizationDetails.description || "No description available",
                headquarters: organizationDetails.targetGeography || targetGeography || "Unknown",
                businessType: organizationDetails.businessType || businessType || "Services",
                role: organizationDetails.role || role || "Unknown",
                news: organizationNews.slice(0, 5)
            };
            
            // Create response template
            const responseTemplate = {
                companyName: companyProfile.name,
                industry: companyProfile.industry,
                businessType: companyProfile.businessType,
                headquarters: companyProfile.headquarters,
                companySize: {
                    annualRevenue: organizationDetails.annualRevenue || "Unknown",
                    employeeCount: organizationDetails.employeeCount || "Unknown"
                },
                productOrServiceDetails: organizationDetails.products || ["Product/Service details not available"],
                salesStrategy: {
                    currentSituation: {
                        opportunitiesAndPriorities: "Digital transformation and innovation",
                        existingTechnologySolutions: ["Cloud Services", "Data Analytics", "AI Solutions"],
                        painPointsAndMarketPressures: ["Competitive market", "Scaling challenges", "Integration needs"]
                    },
                    valueProposition: {
                        keyMessage: `Our solution helps ${companyProfile.name} optimize operations and drive growth.`,
                        benefits: ["Improved efficiency", "Cost reduction", "Enhanced user experience"],
                        differentiation: "Unique combination of technology and service"
                    },
                    potentialObstaclesMitigation: {
                        obstacle1: {
                            description: "Budget constraints",
                            mitigation: "Flexible pricing and ROI calculation"
                        },
                        obstacle2: {
                            description: "Integration complexity",
                            mitigation: "Seamless API integration and support"
                        }
                    },
                    engagementStrategy: [
                        "Executive outreach",
                        "Industry-specific demos",
                        "Proof of concept"
                    ],
                    competitorAnalysis: [
                        {
                            competitor: "Competitor A",
                            strengths: ["Market share", "Brand recognition"],
                            weaknesses: ["High pricing", "Limited customization"]
                        },
                        {
                            competitor: "Competitor B",
                            strengths: ["Technology innovation", "User experience"],
                            weaknesses: ["Small market presence", "Limited support"]
                        }
                    ],
                    ccsScore: 82
                }
            };

            // Step 4: Use AI to generate sales strategy
            const prompt = `
            Generate a comprehensive sales strategy for ${companyProfile.name}.
            
            COMPANY INFORMATION:
            ${JSON.stringify(companyProfile, null, 2)}
            
            I need you to fill in the missing information in this partially completed JSON:
            
            ${JSON.stringify(responseTemplate, null, 2)}
            
            Focus on completing ONLY the salesStrategy section with realistic, data-driven content.
            Make sure to keep the exact same JSON structure.
            DO NOT wrap the response in markdown code blocks.
            DO NOT add any text outside the JSON structure.
            Return ONLY a valid JSON object.
            
            Include a "ccsScore" (Customer Compatibility Score) between 0-100 that reflects how well this company would 
            align with our services.
            `;

            let response = responseTemplate;
            
            try {
                console.log("Sending prompt to AI service...");
                const generatedStrategy = await aiService.generateContent(prompt);
                console.log("Received response from AI service");
                
                try {
                    const cleanedStrategy = cleanJsonResponse(generatedStrategy);
                    const parsedStrategy = JSON.parse(cleanedStrategy);
                    console.log("Successfully parsed AI response as JSON");
                    response = parsedStrategy;
                } catch (parseError) {
                    console.error("Failed to parse AI response:", parseError);
                }
            } catch (aiError) {
                console.error("Error generating AI strategy:", aiError);
            }

            // Step 5: Return the final response
            console.log("Sending final response to client");
            return res.status(200).json(response);
            
        } catch (apiError) {
            console.error("API error:", apiError);
            return res.status(200).json(fallbackResponse);
        }
        
    } catch (error) {
        console.error('Error generating sales strategy:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Error generating sales strategy', 
            error: error.message 
        });
    }
};

module.exports = {
    generateSalesStrategy
};