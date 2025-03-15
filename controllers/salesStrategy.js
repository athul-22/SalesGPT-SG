const https = require('https');
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
        // Get company name and location from request body
        const companyName = req.body?.companyName || 'Google';
        const location = req.body?.location || '';  // Default to empty string if not provided

        console.log(`Fetching company information for ${companyName} ${location ? 'in ' + location : ''}...`);

        // Create a simple fallback response in case everything fails
        const fallbackResponse = {
            companyName: companyName,
            industry: "Technology",
            businessType: "Product and Services",
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
            // Step 1: Search for organization to get ID - now with location filtering
            const searchOptions = {
                method: 'GET',
                hostname: 'apollo-io-no-cookies-required.p.rapidapi.com',
                port: 443,
                path: `/search_organization?q_organization_name=${encodeURIComponent(companyName)}&page=1${location ? '&organization_locations=' + encodeURIComponent(location) : ''}`,
                headers: {
                    'x-rapidapi-key': process.env.RAPID_API_KEY || 'e2941bfeeamshf10306bfb50c2b7p1895c3jsn364eb99e3308',
                    'x-rapidapi-host': 'apollo-io-no-cookies-required.p.rapidapi.com'
                }
            };

            const searchResponse = await safeApiCall(searchOptions);
            
            if (!searchResponse.data || !searchResponse.data.organizations || searchResponse.data.organizations.length === 0) {
                console.log(`No company information found for ${companyName}, using fallback`);
                return res.status(200).json(fallbackResponse);
            }

            let targetCompany;
            const organizations = searchResponse.data.organizations;

            // First try to find an exact match with high employee count
            targetCompany = organizations.find(org => 
              org.name.toLowerCase() === companyName.toLowerCase() && 
              org.employees_count > 1000
            );

            // If not found, look for a close match with website containing the company name
            if (!targetCompany) {
              targetCompany = organizations.find(org => 
                org.name.toLowerCase().includes(companyName.toLowerCase()) &&
                org.website_url && 
                org.website_url.toLowerCase().includes(companyName.toLowerCase())
              );
            }

            // If still not found, just take the organization with highest employee count
            if (!targetCompany) {
              targetCompany = organizations.sort((a, b) => 
                (b.employees_count || 0) - (a.employees_count || 0)
              )[0];
            }

            // Fallback to the first result if nothing else worked
            if (!targetCompany) {
              targetCompany = organizations[0];
            }

            const organizationId = targetCompany.id;
            
            console.log(`Found company: ${targetCompany.name} (ID: ${organizationId})`);

            // Step 2: Make parallel requests for details and news
            let detailsResponse, newsResponse;
            
            try {
                [detailsResponse, newsResponse] = await Promise.all([
                    // Get organization details
                    safeApiCall({
                        method: 'GET',
                        hostname: 'apollo-io-no-cookies-required.p.rapidapi.com',
                        port: 443,
                        path: `/organization_details?id=${organizationId}`,
                        headers: {
                            'x-rapidapi-key': process.env.RAPID_API_KEY || 'e2941bfeeamshf10306bfb50c2b7p1895c3jsn364eb99e3308',
                            'x-rapidapi-host': 'apollo-io-no-cookies-required.p.rapidapi.com'
                        }
                    }),
                    // Get organization news - using id parameter
                    safeApiCall({
                        method: 'GET',
                        hostname: 'apollo-io-no-cookies-required.p.rapidapi.com',
                        port: 443,
                        path: `/organization_news?id=${organizationId}&page=1`,  // Using id instead of organization_id
                        headers: {
                            'x-rapidapi-key': process.env.RAPID_API_KEY || 'e2941bfeeamshf10306bfb50c2b7p1895c3jsn364eb99e3308',
                            'x-rapidapi-host': 'apollo-io-no-cookies-required.p.rapidapi.com'
                        }
                    })
                ]);
            } catch (parallelError) {
                console.error("Error fetching details and news:", parallelError);
                // Continue with what we have from the search
                detailsResponse = { data: { organization: {} } };
                newsResponse = { data: { organization_news: [] } };
            }

            // Step 3: Extract and merge data
            const organizationDetails = detailsResponse?.data?.organization || {};
            const organizationNews = newsResponse?.data?.organization_news || [];
            
            // Create comprehensive company profile for AI processing
            const companyProfile = {
                name: organizationDetails.name || targetCompany.name || companyName,
                website: organizationDetails.website_url || targetCompany.website_url || "Unknown",
                industry: organizationDetails.industry || targetCompany.industry || "Technology",
                description: organizationDetails.short_description || targetCompany.short_description || "No description available",
                headquarters: organizationDetails.raw_address || targetCompany.raw_address || "Unknown",
                founded: organizationDetails.founded_year || targetCompany.founded_year || "Unknown",
                phone: organizationDetails.phone || targetCompany.phone || "Unknown",
                revenue: organizationDetails.organization_revenue_printed || targetCompany.organization_revenue_printed || "Unknown",
                employeeCount: organizationDetails.employees_count || targetCompany.employees_count || "Unknown",
                news: organizationNews.map(news => ({
                    title: news.title || "Unknown",
                    source: news.source || "Unknown",
                    url: news.url || "#",
                    date: news.published_date || "Unknown",
                    summary: news.summary || "No summary available"
                })).slice(0, 5)
            };

            // Determine business type based on description or default appropriately
            const businessType = companyProfile.description.toLowerCase().includes('product') ? 
                (companyProfile.description.toLowerCase().includes('service') ? "Product and Services" : "Product") : "Services";
                
            // Extract main products/services from description or news if available
            let productServices = [];
            
            // Try to extract products from description
            const description = companyProfile.description;
            if (description && description !== "No description available") {
                // Look for product mentions in description
                const productMatches = description.match(/(?:offers|provides|sells|develops)(?:[^.;]*)(?:such as|including|like|:) ([^.;]+)/i);
                if (productMatches && productMatches[1]) {
                    productServices = productMatches[1]
                        .split(/,|\band\b/)
                        .map(item => item.trim())
                        .filter(item => item.length > 0);
                }
            }
            
            // If we couldn't extract from description, try news headlines
            if (productServices.length === 0 && companyProfile.news && companyProfile.news.length > 0) {
                const newsTitles = companyProfile.news.map(item => item.title).join(' ');
                const productWords = newsTitles.match(/\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)\b/g);
                if (productWords) {
                    productServices = [...new Set(productWords)]
                        .filter(word => !word.includes(companyProfile.name))
                        .slice(0, 3);
                }
            }
            
            // If still empty, create some defaults based on industry
            if (productServices.length === 0) {
                if (companyProfile.industry.toLowerCase().includes('tech') || companyProfile.industry.toLowerCase().includes('software')) {
                    productServices = ["Enterprise Software", "Cloud Solutions", "Digital Transformation Services"];
                } else if (companyProfile.industry.toLowerCase().includes('finance') || companyProfile.industry.toLowerCase().includes('bank')) {
                    productServices = ["Financial Services", "Investment Solutions", "Banking Products"];
                } else {
                    productServices = [`${companyProfile.industry} Solutions`, `${companyProfile.industry} Services`, "Professional Consulting"];
                }
            }
            
            // Limit to max 5 products/services
            productServices = productServices.slice(0, 5);

            // Pre-build the base of our JSON response
            const responseTemplate = {
                companyName: companyProfile.name,
                industry: companyProfile.industry,
                businessType: businessType,
                headquarters: companyProfile.headquarters,  // Add this line to include location
                companySize: {
                    annualRevenue: companyProfile.revenue,
                    employeeCount: companyProfile.employeeCount
                },
                productOrServiceDetails: productServices,
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

            // If we don't need AI generation, just return the template
            // return res.status(200).json(responseTemplate);

            // Step 4: Use AI to generate sales strategy in the required format
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
            `;

            let response = responseTemplate;
            
            try {
                console.log("Sending prompt to AI service...");
                // Use AI service to generate strategy
                const generatedStrategy = await aiService.generateContent(prompt);
                console.log("Received response from AI service");
                
                try {
                    // Clean any markdown formatting from the response
                    const cleanedStrategy = cleanJsonResponse(generatedStrategy);
                    console.log("Cleaned response, attempting to parse as JSON");
                    
                    // Parse the cleaned response
                    const parsedStrategy = JSON.parse(cleanedStrategy);
                    console.log("Successfully parsed AI response as JSON");
                    
                    // Merge the AI-generated content with our template
                    response = parsedStrategy;
                } catch (parseError) {
                    console.error("Failed to parse AI response as JSON:", parseError);
                    console.log("AI Response snippet:", generatedStrategy.substring(0, 200) + "...");
                    
                    // Keep using the template but with the basic data we already have
                    console.log("Using fallback response template");
                }
            } catch (aiError) {
                console.error("Error generating AI strategy:", aiError);
                // Continue with the template we already created
            }

            // Step 5: Return response in the exact required format
            console.log("Sending final response to client");
            return res.status(200).json(response);
            
        } catch (apiError) {
            console.error("API error:", apiError);
            // Return fallback response if API calls fail
            return res.status(200).json(fallbackResponse);
        }
        
    } catch (error) {
        console.error('Error generating sales strategy:', error);
        // Return a minimal response with error info
        return res.status(500).json({ 
            success: false, 
            message: 'Error generating sales strategy', 
            error: error.message,
            companyName: req.body?.companyName || 'Unknown',
            industry: "Unknown",
            businessType: "Unknown",
            companySize: {
                annualRevenue: "Unknown",
                employeeCount: "Unknown"
            },
            productOrServiceDetails: ["Unknown"],
            salesStrategy: {
                currentSituation: {
                    opportunitiesAndPriorities: "Unknown due to error",
                    existingTechnologySolutions: ["Unknown"],
                    painPointsAndMarketPressures: ["Unknown"]
                },
                ccsScore: 0
            }
        });
    }
};

module.exports = {
    generateSalesStrategy
};