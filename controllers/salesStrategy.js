const axios = require('axios');
const aiService = require('../services/aiService');
const exaSearchService = require('../services/exaSearchService');

// Add this at the top of your salesStrategy.js file
const MOCK_DATA = {
  executiveStatements: {
    results: [
      {
        text: "Our strategic priorities for 2025 include expanding our cloud infrastructure and enhancing digital security across all platforms. We're investing heavily in AI-driven solutions for better customer experience.",
        url: "https://example.com/executive-statement"
      },
      {
        text: "Digital transformation remains our top focus as we move into 2025, with particular emphasis on cybersecurity and cloud optimization.",
        url: "https://example.com/ceo-interview"
      }
    ]
  },
  geographicExpansion: {
    results: [
      {
        text: "Sea Limited announced plans to expand into new markets in Southeast Asia, particularly focusing on expanding Shopee in Vietnam and Philippines in 2025.",
        url: "https://example.com/expansion-news"
      },
      {
        text: "The company is opening new offices in India as part of their growth strategy for the digital entertainment segment.",
        url: "https://example.com/new-markets"
      }
    ]
  },
  industryTrends: {
    results: [
      {
        text: "E-commerce in Southeast Asia is trending towards integrated payment solutions and cloud-based infrastructure to handle increasing transaction volumes.",
        url: "https://example.com/ecommerce-trends"
      },
      {
        text: "The digital entertainment industry is seeing a shift towards cross-platform gaming and cloud streaming services requiring robust infrastructure solutions.",
        url: "https://example.com/gaming-trends"
      }
    ]
  }
};

/**
 * Generates an enhanced sales strategy with strategic insights
 */
const generateSalesStrategy = async (req, res) => {
  try {
    // Extract updated parameters from new payload structure
    const { 
      companyName, 
      targetGeography, 
      businessType, 
      industry,
      domain,
      userProfile = {},
      technologies_used = [],
      keywords = "",
      decison_makers = [],
      decison_influencers = [],
      hiring_trends = []
    } = req.body;
    
    // User profile now contains all seller information
    const sellerOfferings = userProfile.sellerOfferings || [];
    // Add work experience to the user profile data
    const userWorkExperience = userProfile.workExperience || [];
    
    console.log(`🔍 Generating enhanced sales strategy for ${companyName}`);
    console.log(`👤 User has ${userProfile.previousEmployers?.length || 0} previous employers and ${userWorkExperience.length || 0} work experiences`);
    
    // Get organization data (existing functionality)
    let organizationData = null;
    let errorDetails = null;
    try {
      // Search for the organization
      const searchResult = await searchOrganization(companyName, {
        targetGeography, 
        businessType, 
        industry, 
        domain
      });
      
      // Process search results
      if (searchResult && Array.isArray(searchResult) && searchResult.length > 0) {
        const exactMatch = searchResult.find(org => 
          org.name && org.name.toLowerCase() === companyName.toLowerCase()
        );
        
        const selectedOrg = exactMatch || searchResult[0];
        console.log(`✅ Found organization: ${selectedOrg.name} (ID: ${selectedOrg.id})`);
        
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
    
    // Enrich decision makers and influencers with LinkedIn data
    console.log("\n===== ENRICHING PROFILES WITH LINKEDIN DATA =====");
    try {
      // Process decision makers
      if (decison_makers && decison_makers.length > 0) {
        console.log(`\n📊 Processing ${decison_makers.length} decision makers with LinkedIn URLs`);
        
        for (const exec of decison_makers) {
          if (exec.linkedin_url) {
            console.log(`🔍 Extracting data for ${exec.name} from LinkedIn: ${exec.linkedin_url}`);
            
            // Extract the LinkedIn ID from URL
            const linkedinId = exec.linkedin_url.split('/in/')[1]?.split('/')[0]?.split('?')[0];
            if (linkedinId) {
              console.log(`  LinkedIn ID: ${linkedinId}`);
              
              // If LinkedIn URL already has education/experience data, log it
              if (exec.education) {
                console.log(`  Education: ${JSON.stringify(exec.education)}`);
              }
              
              if (exec.experience || exec.previousEmployers) {
                console.log(`  Work Experience: ${JSON.stringify(exec.experience || exec.previousEmployers)}`);
              }
            }
          }
        }
      }
      
      // Process influencers
      if (decison_influencers && decison_influencers.length > 0) {
        console.log(`\n📊 Processing ${decison_influencers.length} influencers with LinkedIn URLs`);
        
        for (const exec of decison_influencers) {
          if (exec.linkedin_url) {
            console.log(`🔍 Extracting data for ${exec.name} from LinkedIn: ${exec.linkedin_url}`);
            
            // Extract the LinkedIn ID from URL
            const linkedinId = exec.linkedin_url.split('/in/')[1]?.split('/')[0]?.split('?')[0];
            if (linkedinId) {
              console.log(`  LinkedIn ID: ${linkedinId}`);
              
              // If LinkedIn URL already has education/experience data, log it
              if (exec.education) {
                console.log(`  Education: ${JSON.stringify(exec.education)}`);
              }
              
              if (exec.experience || exec.previousEmployers) {
                console.log(`  Work Experience: ${JSON.stringify(exec.experience || exec.previousEmployers)}`);
              }
            }
          }
        }
      }
    } catch (linkedinError) {
      console.error(`❌ Error processing LinkedIn data: ${linkedinError.message}`);
    }
    
    // Use Exa AI to fetch required strategic information
    
    // 1. Get executive strategic priorities from Exa AI
    let executiveInsights = null;
    try {
      console.log("Fetching executive insights from Exa AI...");
      let executiveData;
      try {
        executiveData = await exaSearchService.searchExecutiveStatements(companyName);
      } catch (exaError) {
        if (exaError.response && exaError.response.status === 402) {
          console.log("Using mock data due to Exa API credit limit");
          executiveData = MOCK_DATA.executiveStatements;
        } else {
          throw exaError;
        }
      }
      
      if (executiveData) {
        // Process executive statements to find priorities
        executiveInsights = await extractExecutivePriorities(executiveData, sellerOfferings);
      }
    } catch (exaError) {
      console.error("Error fetching executive insights:", exaError.message);
    }
    
    // 2. Get geographic expansion data from Exa AI
    let geographicInsights = null;
    try {
      console.log("Analyzing geographic expansion plans...");
      let expansionData;
      try {
        expansionData = await exaSearchService.searchGeographicExpansion(companyName);
      } catch (exaError) {
        if (exaError.response && exaError.response.status === 402) {
          console.log("Using mock data due to Exa API credit limit");
          expansionData = MOCK_DATA.geographicExpansion;
        } else {
          throw exaError;
        }
      }
      
      if (expansionData) {
        geographicInsights = extractGeographicOpportunities(expansionData);
      }
    } catch (geoError) {
      console.error("Error analyzing geographic expansion:", geoError.message);
    }
    
    // 3. Get industry trends from Exa AI
    let industryTrendInsights = null;
    try {
      console.log("Fetching industry trends from Exa AI...");
      let industryTrendsData;
      try {
        industryTrendsData = await exaSearchService.searchIndustryTrends(companyName, industry);
      } catch (exaError) {
        if (exaError.response && exaError.response.status === 402) {
          console.log("Using mock data due to Exa API credit limit");
          industryTrendsData = MOCK_DATA.industryTrends;
        } else {
          throw exaError;
        }
      }
      
      if (industryTrendsData) {
        industryTrendInsights = extractIndustryTrends(industryTrendsData, sellerOfferings);
      }
    } catch (trendsError) {
      console.error("Error fetching industry trends:", trendsError.message);
    }
    
    // Process decision makers and influencers for common backgrounds
    let commonBackgroundInsights = [];
    if ((decison_makers.length > 0 || decison_influencers.length > 0) && userProfile) {
      const executives = [...decison_makers, ...decison_influencers];
      console.log(`\n🔄 Finding common backgrounds between user and ${executives.length} executives...`);
      commonBackgroundInsights = findCommonBackgrounds(executives, userProfile);
      
      // Log any found common backgrounds
      if (commonBackgroundInsights.length > 0) {
        console.log('\n✅ Common backgrounds found:');
        commonBackgroundInsights.forEach(connection => {
          console.log(`  - With ${connection.executiveName}: ${connection.commonFactors.map(f => f.detail).join(', ')}`);
        });
      } else {
        console.log('\n⚠️ No common backgrounds found between user and executives');
      }
    } else if (organizationData?.executives && userProfile) {
      commonBackgroundInsights = findCommonBackgrounds(organizationData.executives, userProfile);
    }
    
    // Process technology stack matches
    let techStackInsights = [];
    if (technologies_used.length > 0 && sellerOfferings.length > 0) {
      techStackInsights = matchTechnologyStack(technologies_used, sellerOfferings);
    }
    
    // Process hiring patterns
    let hiringInsights = [];
    if (hiring_trends.length > 0 && sellerOfferings.length > 0) {
      hiringInsights = analyzeHiringPatterns(hiring_trends, sellerOfferings);
    }
    
    // Combine all strategic insights
    const strategicInsights = {
      commonBackgrounds: commonBackgroundInsights,
      executiveStrategicPriorities: executiveInsights || [],
      technologyStackMatches: techStackInsights,
      geographicOpportunities: geographicInsights || [],
      hiringPatternMatches: hiringInsights,
      industryTrendAlignment: industryTrendInsights || []
    };
    
    // Gather decision makers
    const keyPersonnel = {
      decisionMakers: decison_makers,
      influencers: decison_influencers
    };
    
    // Add strategic insights to company profile
    const companyProfile = {
      name: organizationData?.name || companyName,
      industry: organizationData?.industry || industry || "Technology",
      businessType: organizationData?.businessType || businessType || "Services",
      location: organizationData?.targetGeography || targetGeography || "Unknown",
      domain: domain,
      companySize: {
        annualRevenue: organizationData?.annualRevenue || "Unknown",
        employeeCount: organizationData?.employeeCount || "Unknown"
      },
      products: organizationData?.products || [],
      description: organizationData?.description || `A company named ${companyName}`,
      technologies: technologies_used,
      keyPersonnel: keyPersonnel,
      keywords: keywords,
      strategicInsights: strategicInsights
    };
    
    // Generate sales strategy using AI with enhanced data
    const prompt = createEnhancedSalesStrategyPrompt(companyProfile, errorDetails, userProfile);
    console.log("🧠 Sending enhanced data to AI service for strategy generation");
    
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
    
    // Return the complete response
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
 * Search for organization by name
 */
async function searchOrganization(companyName, details = {}) {
  try {
    const apiUrl = process.env.ORGANIZATION_API_URL || 'http://13.235.243.0:3001';
    
    // Call the organization API to search for the company
    const response = await axios({
      method: 'post',
      url: `${apiUrl}/api/organizations/search`,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ORGANIZATION_API_TOKEN}`
      },
      data: {
        name: companyName,
        ...details
      }
    });
    
    return response.data.results || [];
  } catch (error) {
    console.error(`Error searching for organization: ${error.message}`);
    return [];
  }
}

/**
 * Get organization details by ID
 */
async function getOrganizationDetails(organizationId) {
  try {
    const apiUrl = process.env.ORGANIZATION_API_URL || 'http://13.235.243.0:3001';
    
    // Call the organization API to get details
    const response = await axios({
      method: 'get',
      url: `${apiUrl}/api/organizations/${organizationId}`,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ORGANIZATION_API_TOKEN}`
      }
    });
    
    return response.data.organization || null;
  } catch (error) {
    console.error(`Error getting organization details: ${error.message}`);
    return null;
  }
}

/**
 * Find common backgrounds between executives and seller
 */
function findCommonBackgrounds(executives, userProfile) {
  console.log("\n===== FINDING COMMON BACKGROUNDS =====");
  console.log(`👤 User Profile: ${userProfile.name || 'Unknown'}`);
  console.log(`  Education: ${JSON.stringify(userProfile.education || [])}`);
  console.log(`  Previous Employers: ${JSON.stringify(userProfile.previousEmployers || [])}`);
  console.log(`  Location: ${userProfile.location || 'Unknown'}`);
  
  const commonConnections = [];
  
  console.log(`\n🔍 Comparing with ${executives.length} executives...`);
  
  for (const executive of executives) {
    console.log(`\n📋 Analyzing: ${executive.name} - ${executive.position || executive.designation || "Executive"}`);
    
    const commonPoints = {
      executiveName: executive.name,
      executivePosition: executive.position || executive.designation || "Executive",
      linkedin: executive.linkedin_url || null,
      commonFactors: []
    };
    
    // Check for common education
    if (userProfile.education && userProfile.education.length > 0) {
      console.log(`  🎓 Checking education matches...`);
      let executiveEducation = [];
      
      // Handle different education formats 
      if (executive.education && Array.isArray(executive.education)) {
        executiveEducation = executive.education;
        console.log(`  Executive education: ${JSON.stringify(executiveEducation)}`);
      }
      
      for (const school of userProfile.education) {
        const schoolLower = school.toLowerCase();
        
        // Check each education item regardless of format
        for (const eduItem of executiveEducation) {
          let eduItemText = '';
          
          // Handle object or string format
          if (typeof eduItem === 'object') {
            eduItemText = eduItem.school || eduItem.institution || '';
          } else if (typeof eduItem === 'string') {
            eduItemText = eduItem;
          }
          
          if (eduItemText && 
             (eduItemText.toLowerCase().includes(schoolLower) || 
              schoolLower.includes(eduItemText.toLowerCase()))) {
            console.log(`  ✅ MATCH FOUND! Both attended: ${school}`);
            commonPoints.commonFactors.push({
              type: 'education',
              detail: `Both attended ${school}`
            });
          }
        }
      }
    }
    
    // Check for common previous employers
    if (userProfile.previousEmployers && userProfile.previousEmployers.length > 0) {
      console.log(`  🏢 Checking previous employer matches...`);
      let executiveEmployers = [];
      
      // Handle different work experience formats
      if (executive.experience && Array.isArray(executive.experience)) {
        executiveEmployers = executive.experience.map(exp => 
          typeof exp === 'object' ? (exp.company || exp.companyName || '') : exp
        );
        console.log(`  Executive employers: ${JSON.stringify(executiveEmployers)}`);
      } else if (executive.previousEmployers && Array.isArray(executive.previousEmployers)) {
        executiveEmployers = executive.previousEmployers;
        console.log(`  Executive previous employers: ${JSON.stringify(executive.previousEmployers)}`);
      }
      
      for (const employer of userProfile.previousEmployers) {
        checkEmployerMatch(employer, executiveEmployers, commonPoints);
      }
    }
    
    // Check for common location
    if (userProfile.location && executive.location) {
      console.log(`  📍 Checking location matches...`);
      console.log(`  User location: ${userProfile.location}, Executive location: ${executive.location}`);
      
      const userLocationLower = userProfile.location.toLowerCase();
      const executiveLocationLower = executive.location.toLowerCase();
      
      if (executiveLocationLower.includes(userLocationLower) ||
          userLocationLower.includes(executiveLocationLower)) {
        console.log(`  ✅ MATCH FOUND! Common location: ${userProfile.location}`);
        commonPoints.commonFactors.push({
          type: 'location',
          detail: `Both have connection to ${userProfile.location}`
        });
      }
    }
    
    // Log results for this executive
    if (commonPoints.commonFactors.length > 0) {
      console.log(`  🎯 Found ${commonPoints.commonFactors.length} common factors with ${executive.name}`);
      commonConnections.push(commonPoints);
    } else {
      console.log(`  ❌ No common factors found with ${executive.name}`);
    }
  }
  
  console.log(`\n🔄 Total common connections found: ${commonConnections.length}`);
  return commonConnections;
}

/**
 * Extract executive priorities from Exa AI data
 */
function extractExecutivePriorities(exaData, sellerOfferings) {
  try {
    const priorities = [];
    
    if (exaData && exaData.results) {
      for (const result of exaData.results) {
        const text = result.text || '';
        
        // Look for priority statements
        const priorityMatches = text.match(/(?:priority|priorities|focus|focusing|strategic|strategy|initiative|plan|planning|roadmap|goal|investing|investment)\s+(?:is|are|on|for|to)\s+([^\.]+)/gi);
        
        if (priorityMatches) {
          for (const match of priorityMatches) {
            // For each priority, check alignment with offerings
            for (const offering of sellerOfferings) {
              if (match.toLowerCase().includes(offering.toLowerCase())) {
                priorities.push({
                  priority: match,
                  offering: offering,
                  alignmentStrength: "medium",
                  reason: `Executive priority mentions technologies/areas related to ${offering}`
                });
              }
            }
          }
        }
      }
    }
    
    return priorities;
  } catch (error) {
    console.error(`Error extracting executive priorities: ${error.message}`);
    return [];
  }
}

/**
 * Extract geographic opportunities from Exa AI data
 */
function extractGeographicOpportunities(exaData) {
  try {
    const opportunities = [];
    
    if (exaData && exaData.results) {
      for (const result of exaData.results) {
        if (result.text) {
          // Extract location mentions
          const locationMatches = result.text.match(/(?:expand(?:ing|ed|s)?|enter(?:ing|ed|s)?|open(?:ing|ed)?|new)\s+(?:in|into|to|at)\s+([A-Za-z\s,]+)(?:market|region|office|headquarters|HQ)?/gi);
          
          if (locationMatches) {
            for (const match of locationMatches) {
              // Extract just the location name
              const locationMatch = match.match(/(?:in|into|to|at)\s+([A-Za-z\s,]+)(?:market|region|office|headquarters|HQ)?/i);
              if (locationMatch && locationMatch[1]) {
                const location = locationMatch[1].trim();
                opportunities.push({
                  location: location,
                  source: result.url || "Unknown",
                  snippet: result.text
                });
              }
            }
          }
        }
      }
    }
    
    return opportunities;
  } catch (error) {
    console.error(`Error extracting geographic opportunities: ${error.message}`);
    return [];
  }
}

/**
 * Extract industry trends from Exa AI data
 */
function extractIndustryTrends(exaData, sellerOfferings) {
  try {
    // Extract trends and match with offerings
    const trendAlignments = [];
    
    if (exaData && exaData.results) {
      for (const result of exaData.results) {
        if (result.text) {
          // Look for trend indicators in text
          const trendMatches = result.text.match(/(?:trend|growing|emerging|rising|increasing|future|next-generation|innovative|disruption|transformation|shift(?:ing)?)\s+(?:in|towards|to|of)\s+([A-Za-z\s,\-]+)/gi);
          
          if (trendMatches) {
            for (const match of trendMatches) {
              // Extract the trend
              const trendMatch = match.match(/(?:in|towards|to|of)\s+([A-Za-z\s,\-]+)/i);
              if (trendMatch && trendMatch[1]) {
                const trend = {
                  name: trendMatch[1].trim(),
                  description: result.text,
                  source: result.url || "Unknown"
                };
                
                // Check if trend aligns with any offerings
                for (const offering of sellerOfferings) {
                  const offeringLower = offering.toLowerCase();
                  const trendNameLower = trend.name.toLowerCase();
                  
                  if (trendNameLower.includes(offeringLower) || 
                      offeringLower.includes(trendNameLower) ||
                      trend.description.toLowerCase().includes(offeringLower)) {
                    trendAlignments.push({
                      trend: trend.name,
                      offering: offering,
                      alignment: 'Seller offering aligns with industry trend',
                      description: trend.description
                    });
                  }
                }
              }
            }
          }
        }
      }
    }
    
    return trendAlignments;
  } catch (error) {
    console.error(`Error extracting industry trends: ${error.message}`);
    return [];
  }
}

/**
 * Match technology stack with seller offerings
 */
function matchTechnologyStack(technologies, sellerOfferings) {
  const matches = [];
  
  // Ensure we have valid data
  if (!technologies || !Array.isArray(technologies) || !sellerOfferings || !Array.isArray(sellerOfferings)) {
    console.log('Invalid data for technology stack matching');
    return matches;
  }
  
  for (const tech of technologies) {
    for (const offering of sellerOfferings) {
      // Convert both to lowercase for case-insensitive matching
      const techLower = typeof tech === 'string' ? tech.toLowerCase() : 
                       tech.name ? tech.name.toLowerCase() : '';
      const offeringLower = offering.toLowerCase();
      
      // Check for direct matches or related technology matches
      if (techLower.includes(offeringLower) || offeringLower.includes(techLower)) {
        matches.push({
          technology: typeof tech === 'string' ? tech : tech.name || 'Unknown Tech',
          offering: offering,
          matchType: 'direct'
        });
      }
    }
  }
  
  return matches;
}

/**
 * Analyze hiring patterns for matches with seller offerings
 */
function analyzeHiringPatterns(jobPostings, sellerOfferings) {
  const matches = [];
  
  // Ensure we have valid data
  if (!jobPostings || !Array.isArray(jobPostings) || !sellerOfferings || !Array.isArray(sellerOfferings)) {
    console.log('Invalid data for hiring pattern analysis');
    return matches;
  }
  
  for (const job of jobPostings) {
    const jobTitle = job.title || '';
    const jobDescription = job.description || '';
    
    for (const offering of sellerOfferings) {
      // Convert to lowercase for case-insensitive matching
      const offeringLower = offering.toLowerCase();
      const titleLower = jobTitle.toLowerCase();
      const descriptionLower = jobDescription.toLowerCase();
      
      if (titleLower.includes(offeringLower) || descriptionLower.includes(offeringLower)) {
        matches.push({
          jobTitle: jobTitle,
          offering: offering,
          reason: titleLower.includes(offeringLower) ? 
            'Job title directly relates to seller offering' : 
            'Job description mentions technology/service related to seller offering'
        });
      }
    }
  }
  
  return matches;
}

/**
 * Create enhanced sales strategy prompt with all gathered information
 */
function createEnhancedSalesStrategyPrompt(companyProfile, errorDetails, userProfile) {
  return `
    Generate a comprehensive sales strategy for a ${userProfile.businessType || ''} business in the ${userProfile.industry || ''} industry targeting ${companyProfile.name}.
    
    SALES REPRESENTATIVE PROFILE:
    Name: ${userProfile.name || 'Sales Representative'}
    Role: ${userProfile.role || 'Sales Professional'}
    Company: ${userProfile.company || 'Our Company'}
    Business Type: ${userProfile.businessType || 'Service/Product Provider'}
    Industry Focus: ${userProfile.industry || 'Technology Solutions'}
    Location: ${userProfile.location || 'Global'}
    ${userProfile.education ? `Education: ${JSON.stringify(userProfile.education)}` : ''}
    ${userProfile.previousEmployers ? `Previous Employers: ${JSON.stringify(userProfile.previousEmployers)}` : ''}
    ${userProfile.workExperience ? `Work Experience: ${JSON.stringify(userProfile.workExperience)}` : ''}

    YOUR PRODUCT/SERVICE OFFERING:
    ${userProfile.productDescription || 'A professional solution that helps organizations improve their operations and achieve their goals.'}
    Products/Services: ${JSON.stringify(userProfile.sellerOfferings || [])}
    
    TARGET COMPANY INFORMATION:
    Name: ${companyProfile.name}
    Industry: ${companyProfile.industry}
    Business Type: ${companyProfile.businessType}
    Location: ${companyProfile.location}
    Domain: ${companyProfile.domain || 'Not available'}
    Technologies Used: ${JSON.stringify(companyProfile.technologies || [])}
    Keywords: ${companyProfile.keywords || 'Not available'}
    
    KEY PERSONNEL:
    Decision Makers: ${JSON.stringify(companyProfile.keyPersonnel?.decisionMakers || [])}
    Influencers: ${JSON.stringify(companyProfile.keyPersonnel?.influencers || [])}
    
    STRATEGIC INSIGHTS:
    
    ${companyProfile.strategicInsights.commonBackgrounds.length > 0 ? 
      `COMMON BACKGROUNDS WITH EXECUTIVES:
      ${JSON.stringify(companyProfile.strategicInsights.commonBackgrounds, null, 2)}` : 
      'No common backgrounds found with executives.'}
    
    ${companyProfile.strategicInsights.executiveStrategicPriorities.length > 0 ? 
      `EXECUTIVE PRIORITIES ALIGNMENT:
      ${JSON.stringify(companyProfile.strategicInsights.executiveStrategicPriorities, null, 2)}` : 
      'No executive priority alignments identified.'}
    
    ${companyProfile.strategicInsights.technologyStackMatches.length > 0 ? 
      `TECHNOLOGY STACK MATCHES:
      ${JSON.stringify(companyProfile.strategicInsights.technologyStackMatches, null, 2)}` : 
      'No technology stack matches found.'}
    
    ${companyProfile.strategicInsights.geographicOpportunities.length > 0 ? 
      `GEOGRAPHIC EXPANSION OPPORTUNITIES:
      ${JSON.stringify(companyProfile.strategicInsights.geographicOpportunities, null, 2)}` : 
      'No geographic expansion opportunities identified.'}
    
    ${companyProfile.strategicInsights.hiringPatternMatches.length > 0 ? 
      `HIRING PATTERN MATCHES:
      ${JSON.stringify(companyProfile.strategicInsights.hiringPatternMatches, null, 2)}` : 
      'No hiring pattern matches found.'}
    
    ${companyProfile.strategicInsights.industryTrendAlignment.length > 0 ? 
      `INDUSTRY TREND ALIGNMENTS:
      ${JSON.stringify(companyProfile.strategicInsights.industryTrendAlignment, null, 2)}` : 
      'No industry trend alignments found.'}
    
    ${errorDetails ? `NOTE: There was an issue retrieving complete company data: ${errorDetails.message}
    If you know information about this company, please include it in your response.` : ''}
    
    Please generate a complete sales strategy that specifically positions ${userProfile.company || 'our'} ${userProfile.businessType || ''} 
    solutions for ${companyProfile.name}.
    
    IMPORTANT: Return the response as valid JSON without any comments.
    Do not include any explanatory text, JavaScript comments, or markdown outside the JSON.
    
    Required JSON format:
    {
      "companyName": "${companyProfile.name}",
      "industry": "Industry name",
      "businessType": "Business type",
      "headquarters": "Headquarters location",
      "companySize": {
        "annualRevenue": "Revenue information",
        "employeeCount": "Employee count"
      },
      "productOrServiceDetails": [
        "Product/Service 1",
        "Product/Service 2"
      ],
      "salesStrategy": {
        "currentSituation": {
          "opportunitiesAndPriorities": "Description",
          "existingTechnologySolutions": ["Solution 1", "Solution 2"],
          "painPointsAndMarketPressures": ["Pain point 1", "Pain point 2"]
        },
        "valueProposition": {
          "keyMessage": "Key message",
          "benefits": ["Benefit 1", "Benefit 2"],
          "differentiation": "Differentiation"
        },
        "relevanceToProspect": "Explain specifically how your solution addresses the target company's needs",
        "potentialObstaclesMitigation": {
          "obstacle1": {
            "description": "Description",
            "mitigation": "Mitigation"
          },
          "obstacle2": {
            "description": "Description",
            "mitigation": "Mitigation"
          }
        },
        "strategicAdvantagePoints": {
          "commonBackgrounds": "How to leverage common backgrounds with executives",
          "executivePriorities": "How to align with executive strategic priorities",
          "technologyMatches": "How to leverage technology stack matches",
          "geographicOpportunities": "How to capitalize on geographic expansion",
          "hiringInsights": "How to address needs indicated by hiring patterns",
          "industryTrendAlignment": "How to position offering within industry trends"
        },
        "engagementStrategy": ["Strategy 1", "Strategy 2"],
        "keyDecisionMakers": [{
          "name": "Executive Name",
          "role": "Executive Role",
          "commonBackground": "Any shared background",
          "approachStrategy": "Personalized approach based on background"
        }],
        "competitorAnalysis": [
          {
            "competitor": "Competitor Name",
            "relevance": "Why this competitor is relevant",
            "strengths": ["Strength 1", "Strength 2"],
            "weaknesses": ["Weakness 1", "Weakness 2"]
          }
        ]
      }
    }
    
    Make the sales strategy highly specific to selling ${userProfile.businessType || ''} solutions to this specific company.
    Use the strategic insights to create a more personalized and effective strategy.
    Return ONLY valid JSON without any additional text or comments.
  `;
}

/**
 * Parse AI response into structured sales strategy
 */
function parseAIResponse(aiResponse, companyProfile) {
  try {
    // Clean up the response to extract just the JSON
    let cleanedResponse = aiResponse;
    
    // Remove any markdown code block indicators
    cleanedResponse = cleanedResponse.replace(/```json|```/g, '').trim();
    
    // Remove JavaScript comments (both line and block comments)
    cleanedResponse = cleanedResponse.replace(/\/\/.*$/gm, ''); // Remove single line comments
    cleanedResponse = cleanedResponse.replace(/\/\*[\s\S]*?\*\//g, ''); // Remove block comments
    
    // Fix trailing commas in objects and arrays (a common issue with AI-generated JSON)
    cleanedResponse = cleanedResponse.replace(/,(\s*[}\]])/g, '$1');
    
    // Additional fixes for common JSON issues with Gemini's output
    cleanedResponse = cleanedResponse.replace(/,\s*,/g, ','); // Remove double commas
    
    // Handle inline comments that might be after valid JSON properties
    cleanedResponse = cleanedResponse.replace(/"([^"]+)"(\s*):(\s*)([^,\}\]]+)\/\/.*$/gm, '"$1"$2:$3$4');
    
    console.log("Cleaned JSON before parsing:", cleanedResponse.substring(0, 150) + "...");
    
    // Parse the JSON response
    const salesStrategy = JSON.parse(cleanedResponse);
    
    // Add metadata
    return {
      companyName: companyProfile.name,
      industry: salesStrategy.industry || companyProfile.industry,
      businessType: salesStrategy.businessType || companyProfile.businessType,
      headquarters: salesStrategy.headquarters || companyProfile.location,
      companySize: salesStrategy.companySize || companyProfile.companySize,
      productOrServiceDetails: salesStrategy.productOrServiceDetails || [],
      salesStrategy: salesStrategy.salesStrategy || {}
    };
  } catch (error) {
    console.error('Error parsing AI response:', error);
    
    // Return a simplified structure if parsing fails
    return {
      companyName: companyProfile.name,
      industry: companyProfile.industry,
      businessType: companyProfile.businessType,
      headquarters: companyProfile.location,
      companySize: companyProfile.companySize,
      salesStrategy: {
        error: "Failed to parse complete sales strategy",
        rawResponse: aiResponse.substring(0, 500) + "..."
      }
    };
  }
}

/**
 * Helper function to check for employer matches
 */
function checkEmployerMatch(employer, executiveEmployers, commonPoints) {
  const employerLower = employer.toLowerCase();
  
  for (const empItem of executiveEmployers) {
    const empItemLower = typeof empItem === 'string' ? 
      empItem.toLowerCase() : 
      (empItem && empItem.company) ? empItem.company.toLowerCase() : '';
    
    if (empItemLower && 
       (empItemLower.includes(employerLower) || employerLower.includes(empItemLower))) {
      console.log(`  ✅ MATCH FOUND! Both worked at: ${employer}`);
      commonPoints.commonFactors.push({
        type: 'previous_employer',
        detail: `Both worked at ${employer}`
      });
    }
  }
}

/**
 * Helper function to check for title/role matches
 */
function checkTitleMatch(userTitle, executiveExperience, commonPoints) {
  const titleLower = userTitle.toLowerCase();
  
  for (const exp of executiveExperience) {
    if (typeof exp === 'object' && exp.title) {
      const expTitleLower = exp.title.toLowerCase();
      if (expTitleLower.includes(titleLower) || titleLower.includes(expTitleLower)) {
        console.log(`  ✅ MATCH FOUND! Similar role: ${userTitle} - ${exp.title}`);
        commonPoints.commonFactors.push({
          type: 'similar_role',
          detail: `Both had similar roles: ${userTitle} / ${exp.title}`
        });
      }
    }
  }
}

module.exports = {
  generateSalesStrategy,
  findCommonBackgrounds,
  extractExecutivePriorities,
  extractGeographicOpportunities,
  extractIndustryTrends,
  matchTechnologyStack,
  analyzeHiringPatterns,
  parseAIResponse,
  searchOrganization,
  getOrganizationDetails,
  createEnhancedSalesStrategyPrompt,
  checkEmployerMatch,
  checkTitleMatch
};