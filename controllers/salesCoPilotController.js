const organizationService = require('../services/organizationService');
const aiService = require('../services/aiService');
const chromaService = require('../services/chromaService');

// In-memory conversation history store - for production, use a database
const conversationStore = {};

/**
 * Sales Co-Pilot API that enables conversational interaction about target companies
 */
const salesCoPilot = async (req, res) => {
  try {
    const { company, query, userId, user_data = [], userProfile = {}, userContext = {} } = req.body;

    // Validation
    if (!company || !query || !userId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters. Please provide company, query, and userId.'
      });
    }

    console.log(`Processing Sales Co-Pilot request for company: ${company}`);
    console.log(`User query: "${query}"`);

    // Initialize or retrieve conversation history
    if (!conversationStore[userId]) {
      conversationStore[userId] = {};
    }
    
    if (!conversationStore[userId][company]) {
      conversationStore[userId][company] = [];
    }
    
    const conversationHistory = conversationStore[userId][company];

    // Get company information
    let companyInfo = {};
    let companyError = null;
    try {
      const organizations = await organizationService.searchOrganizations(company);
      if (Array.isArray(organizations) && organizations.length > 0) {
        // Find the best match for the company
        const targetCompany = organizations.find(org => 
          org.name && company && org.name.toLowerCase() === company.toLowerCase()
        ) || organizations[0];
        
        // Get detailed information
        companyInfo = await organizationService.getOrganizationDetails(targetCompany.id);
        console.log(`Found company information for: ${targetCompany.name}`);
      } else {
        companyError = `No company information found for: ${company}`;
        console.log(companyError);
      }
    } catch (error) {
      companyError = `Error fetching company information: ${error.message || error}`;
      console.error(companyError);
    }

    // Search document database for relevant information
    let documentContext = "";
    let documentError = null;
    try {
      console.log(`Querying ChromaDB with: "${company} ${query}"`);
      
      // Create a more comprehensive search query using both the company, query and user data
      const searchTerms = [`${company}`, `${query}`];
      
      // Add any user_data to the search context if available
      if (user_data && user_data.length > 0) {
        console.log("Using additional user data for document search");
        searchTerms.push(...user_data);
      }
      
      // Join with spaces and remove any double spaces
      const searchQuery = searchTerms.join(' ').replace(/\s+/g, ' ').trim();
      console.log(`Final ChromaDB search query: "${searchQuery}"`);
      
      let docResults = null;
      try {
        docResults = await chromaService.queryAllDocumentCollections(searchQuery, 5);
        console.log("ChromaDB search results:", JSON.stringify({
          hasResults: !!docResults,
          totalCollections: docResults?.totalCollections,
          searchedCollections: docResults?.searchedCollections,
          totalResults: docResults?.totalResults,
          documentsCount: docResults?.documents?.length
        }));
      } catch (chromaError) {
        console.error("Error in ChromaDB search:", chromaError);
        documentError = `ChromaDB search error: ${chromaError.message}`;
        // Continue without ChromaDB results
      }
      
      // Use fallback empty result if ChromaDB search failed
      if (!docResults) {
        docResults = {
          documents: [],
          query: searchQuery,
          totalCollections: 0,
          searchedCollections: 0,
          totalResults: 0,
          error: documentError
        };
      }
      
      // Process results only if documents exist
      if (docResults.documents && docResults.documents.length > 0) {
        // Handle different result structures that might come back
        let relevantDocs = [];
        
        if (Array.isArray(docResults.documents)) {
          // If documents is an array of documents
          relevantDocs = docResults.documents;
        } else if (Array.isArray(docResults.documents[0])) {
          // If documents is an array of arrays
          relevantDocs = docResults.documents[0];
        }
        
        if (relevantDocs.length > 0) {
          // Check if each document is an object with a text property or already a string
          const texts = relevantDocs.map(doc => {
            if (typeof doc === 'string') return doc;
            if (doc && doc.text) return doc.text;
            if (doc && doc.document) return doc.document;
            return JSON.stringify(doc).substring(0, 100); // Fallback
          });
          
          documentContext = texts.join("\n\n").substring(0, 3000); // Increased from 2000
          console.log(`Found relevant document information: ${documentContext.length} characters`);
        }
      } else {
        console.log("No matching documents found in ChromaDB");
        documentContext = "No relevant documents found in the knowledge base.";
      }
    } catch (error) {
      documentError = `Error searching document database: ${error.message || error}`;
      console.error("ChromaDB search error:", error);
      
      // Add more details to help debugging
      if (error.stack) {
        console.error("Error stack:", error.stack);
      }
    }

    // Format conversation history for the AI
    const conversationLog = conversationHistory.map(entry => 
      `User: ${entry.query}\nAI: ${entry.response}`
    ).join('\n\n');

    // Construct prompt for AI service
    const prompt = `
      You are an AI sales co-pilot assistant, helping a sales professional engage with ${company}.
      
      ${userProfile && Object.keys(userProfile).length > 0 ? 
        `SALES REPRESENTATIVE PROFILE:
        Name: ${userProfile.name || 'Sales Representative'}
        Role: ${userProfile.role || 'Sales Professional'}
        Company: ${userProfile.company || 'Our Company'}
        Business Type: ${userProfile.businessType || 'Service/Product Provider'}
        Industry Focus: ${userProfile.industry || 'Technology Solutions'}
        Location: ${userProfile.location || 'Global'}` : ''}
      
      ${userContext && userContext.productDescription ? 
        `YOUR PRODUCT/SERVICE OFFERING:
        ${userContext.productDescription}` : ''}
      
      ${user_data && user_data.length > 0 ? 
        `USER-PROVIDED CONTEXT ABOUT THE COMPANY:\n${user_data.join("\n")}\n\n` : ''}
      
      COMPANY INFORMATION FROM DATABASE:
      ${Object.keys(companyInfo).length > 0 ? 
        JSON.stringify(companyInfo, null, 2) : 
        "No structured company information available from our database."}
      ${companyError ? `NOTE: ${companyError}` : ''}
      
      RELEVANT KNOWLEDGE BASE DOCUMENTS:
      ${documentContext ? documentContext : "No relevant documents found in knowledge base."}
      ${documentError ? `NOTE: ${documentError}` : ''}
      
      CONVERSATION HISTORY:
      ${conversationLog || "This is the start of the conversation."}
      
      USER QUERY: ${query}
      
      First, determine if you have sufficient information to answer the query effectively. If not, acknowledge what's missing.
      
      Then, provide a helpful, concise response that:
      1. Draws from both the company database AND knowledge base documents when relevant
      2. Clearly indicates when information comes from our knowledge base vs. external company database
      3. Addresses the specific question without unnecessary information
      4. When appropriate, suggests ways the sales representative's ${userProfile.businessType || ''} offering in ${userProfile.industry || ''} could be relevant to ${company}'s needs
      
      Finally, suggest 3 relevant follow-up questions the user might want to ask next.
      
      Format your response as JSON with the following structure:
      {
        "response": "Your detailed answer here",
        "followUpQuestions": ["Question 1?", "Question 2?", "Question 3?"]
      }
    `;

    // Generate AI response
    const aiResult = await aiService.generateContent(prompt);
    
    // Parse AI response (handle potential JSON parsing issues)
    let parsedResponse;
    try {
      // Clean up the response in case it has markdown code blocks
      const cleanedResponse = aiResult.replace(/```json|```/g, '').trim();
      parsedResponse = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      
      // Fallback for invalid JSON responses
      parsedResponse = {
        response: aiResult,
        followUpQuestions: [
          "Can you tell me more about this company?",
          "What are their key pain points?",
          "How can our solution help them?"
        ]
      };
    }

    // Store this interaction in history
    conversationHistory.push({
      query,
      response: parsedResponse.response,
      timestamp: new Date().toISOString()
    });

    // Limit history size to prevent memory issues (keep last 10 interactions)
    if (conversationHistory.length > 10) {
      conversationHistory.shift();
    }

    // Return response with any errors encountered
    return res.status(200).json({
      success: true,
      response: parsedResponse.response,
      followUpQuestions: parsedResponse.followUpQuestions,
      conversationHistory,
      errors: {
        companyError: companyError,
        documentError: documentError
      }
    });

  } catch (error) {
    console.error('Error in Sales Co-Pilot:', error);
    return res.status(500).json({
      success: false,
      message: 'Error processing Sales Co-Pilot request',
      error: error.message
    });
  }
};

/**
 * Clear conversation history for a user
 */
const clearConversationHistory = async (req, res) => {
  try {
    const { userId, company } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameter: userId'
      });
    }

    if (conversationStore[userId]) {
      if (company) {
        // Clear specific company conversation
        conversationStore[userId][company] = [];
        console.log(`Cleared conversation history for user ${userId} and company ${company}`);
      } else {
        // Clear all conversations for this user
        conversationStore[userId] = {};
        console.log(`Cleared all conversation history for user ${userId}`);
      }
    }

    return res.status(200).json({
      success: true,
      message: company 
        ? `Conversation history cleared for company: ${company}` 
        : 'All conversation history cleared'
    });
  } catch (error) {
    console.error('Error clearing conversation history:', error);
    return res.status(500).json({
      success: false,
      message: 'Error clearing conversation history',
      error: error.message
    });
  }
};


const getCompanyInfo = async (req, res) => {
  try {
    const { company, useExaAi = false, userId } = req.body;
    
    if (!company) {
      return res.status(400).json({
        success: false,
        message: 'Company name is required'
      });
    }
    
    // Get company info from primary source
    let companyInfo = {};
    let companyError = null;
    
    try {
      // Try organization service first
      const organizations = await organizationService.searchOrganizations(company);
      if (Array.isArray(organizations) && organizations.length > 0) {
        // Use best match
        const targetCompany = organizations.find(org => 
          org.name && company && org.name.toLowerCase() === company.toLowerCase()
        ) || organizations[0];
        
        companyInfo = await organizationService.getOrganizationDetails(targetCompany.id);
        console.log(`Found company information for: ${targetCompany.name}`);
      } else {
        companyError = `No company information found in primary source`;
      }
    } catch (error) {
      companyError = `Error with primary data source: ${error.message}`;
    }
    
    // If requested and primary source failed, try Exa.ai
    let exaInfo = null;
    let exaError = null;
    
    if (useExaAi && (Object.keys(companyInfo).length === 0 || companyError)) {
      try {
        // Import dynamically to avoid circular dependencies
        const exaSearchService = require('../services/exaSearchService');
        exaInfo = await exaSearchService.searchCompanyInfo(company);
        console.log(`Found Exa.ai information for: ${company}`);
      } catch (exaErr) {
        exaError = `Error with Exa.ai: ${exaErr.message}`;
      }
    }
    
    return res.status(200).json({
      success: true,
      company,
      primarySource: {
        data: companyInfo,
        error: companyError
      },
      exaSource: useExaAi ? {
        data: exaInfo,
        error: exaError
      } : null
    });
  } catch (error) {
    console.error('Error getting company info:', error);
    return res.status(500).json({
      success: false,
      message: 'Error processing request',
      error: error.message
    });
  }
};

const getStrategicSalesInsights = async (req, res) => {
  try {
    const { 
      company, 
      userId, 
      sellerProfile = {}, 
      sellerOfferings = [] 
    } = req.body;
    
    if (!company) {
      return res.status(400).json({
        success: false,
        message: 'Company name is required'
      });
    }
    
    // Get comprehensive company information
    const companyData = await getEnhancedCompanyData(company);
    
    // Get key executives from LinkedIn
    const executives = await getKeyExecutives(company);
    
    // Generate strategic insights
    const strategicInsights = await generateStrategicInsights(
      companyData, 
      executives, 
      sellerProfile, 
      sellerOfferings
    );
    
    return res.status(200).json({
      success: true,
      company,
      insights: strategicInsights,
      companyData: {
        summary: companyData.summary,
        executiveCount: executives.length
      }
    });
  } catch (error) {
    console.error('Error generating strategic sales insights:', error);
    return res.status(500).json({
      success: false,
      message: 'Error processing strategic sales insights',
      error: error.message
    });
  }
};

/**
 * Gets enhanced company data from multiple sources
 */
async function getEnhancedCompanyData(company) {
  // Get primary company information from organization service
  let companyData = { summary: {}, technologies: [], locations: [], trends: [] };
  
  try {
    const organizations = await organizationService.searchOrganizations(company);
    if (Array.isArray(organizations) && organizations.length > 0) {
      // Find best match
      const targetCompany = organizations.find(org => 
        org.name && company && org.name.toLowerCase() === company.toLowerCase()
      ) || organizations[0];
      
      // Get detailed company information
      const details = await organizationService.getOrganizationDetails(targetCompany.id);
      companyData.summary = details;
      
      // Extract technologies if available
      if (details.technologies) {
        companyData.technologies = details.technologies;
      }
      
      // Extract locations if available
      if (details.locations) {
        companyData.locations = details.locations;
      }
      
      // Extract recent news or announcements
      if (details.recent_news) {
        companyData.recentNews = details.recent_news;
      }
      
      // Extract hiring trends
      if (details.job_postings) {
        companyData.jobPostings = details.job_postings;
      }
    }
  } catch (error) {
    console.error(`Error fetching organization data: ${error.message}`);
  }
  
  // Enhance with industry trends via AI analysis
  try {
    const aiService = require('../services/aiService');
    const prompt = `
      Based on recent industry data, what are the top 5 strategic priorities and trends
      for companies in the ${companyData.summary.industry || company} sector?
      Format the response as JSON with fields: 
      { "trends": [{"name": "trend name", "description": "brief explanation"}] }
    `;
    
    const trendAnalysis = await aiService.generateContent(prompt);
    try {
      const parsedTrends = JSON.parse(trendAnalysis.replace(/```json|```/g, '').trim());
      companyData.industryTrends = parsedTrends.trends;
    } catch (parseError) {
      console.error('Error parsing AI trend analysis:', parseError);
    }
  } catch (aiError) {
    console.error(`Error generating industry trends: ${aiError.message}`);
  }
  
  return companyData;
}

/**
 * Gets key executives from LinkedIn using Exa service
 */
async function getKeyExecutives(company) {
  try {
    const exaService = require('../services/exaService');
    
    // Search for C-level executives
    const cLevelProfiles = await exaService.searchLinkedInProfiles(
      company, 
      'CEO OR CTO OR CMO OR CIO', 
      '', // Location left blank for broader search
      5,  // Limit to 5 executives
      'technology OR strategy' // Focus on technology leaders
    );
    
    return cLevelProfiles || [];
  } catch (error) {
    console.error(`Error fetching LinkedIn profiles: ${error.message}`);
    return [];
  }
}

/**
 * Generate strategic insights for sales alignment
 */
async function generateStrategicInsights(companyData, executives, sellerProfile, sellerOfferings) {
  const insights = {
    commonBackgrounds: [],
    executiveStrategicPriorities: [],
    technologyStackMatches: [],
    geographicOpportunities: [],
    hiringPatternMatches: [],
    industryTrendAlignment: []
  };
  
  // 1. Identify common backgrounds
  if (executives.length > 0 && sellerProfile) {
    insights.commonBackgrounds = await findCommonBackgrounds(executives, sellerProfile);
  }
  
  // 2. Match executive priorities with seller offerings
  if (companyData.recentNews && sellerOfferings.length > 0) {
    insights.executiveStrategicPriorities = await matchExecutivePriorities(
      companyData.recentNews, 
      sellerOfferings
    );
  }
  
  // 3. Detect technology stack matches
  if (companyData.technologies && sellerOfferings.length > 0) {
    insights.technologyStackMatches = matchTechnologyStack(
      companyData.technologies, 
      sellerOfferings
    );
  }
  
  // 4. Identify geographic opportunities
  if (companyData.locations && sellerProfile.regions) {
    insights.geographicOpportunities = identifyGeographicOpportunities(
      companyData.locations, 
      sellerProfile.regions
    );
  }
  
  // 5. Analyze hiring patterns
  if (companyData.jobPostings && sellerOfferings.length > 0) {
    insights.hiringPatternMatches = analyzeHiringPatterns(
      companyData.jobPostings, 
      sellerOfferings
    );
  }
  
  // 6. Align industry trends with offerings
  if (companyData.industryTrends && sellerOfferings.length > 0) {
    insights.industryTrendAlignment = alignIndustryTrends(
      companyData.industryTrends, 
      sellerOfferings
    );
  }
  
  return insights;
}

/**
 * Find common backgrounds between executives and seller
 */
async function findCommonBackgrounds(executives, sellerProfile) {
  const commonConnections = [];
  
  for (const executive of executives) {
    const commonPoints = {
      executiveName: executive.name,
      executivePosition: executive.designation,
      commonFactors: []
    };
    
    // Check for common education
    if (sellerProfile.education && executive.snippet) {
      for (const school of sellerProfile.education) {
        if (executive.snippet.toLowerCase().includes(school.toLowerCase())) {
          commonPoints.commonFactors.push({
            type: 'education',
            detail: `Both attended ${school}`
          });
        }
      }
    }
    
    // Check for common previous employers
    if (sellerProfile.previousEmployers && executive.snippet) {
      for (const employer of sellerProfile.previousEmployers) {
        if (executive.snippet.toLowerCase().includes(employer.toLowerCase())) {
          commonPoints.commonFactors.push({
            type: 'previous_employer',
            detail: `Both worked at ${employer}`
          });
        }
      }
    }
    
    // Check for common locations
    if (sellerProfile.locations && executive.location) {
      for (const location of sellerProfile.locations) {
        if (executive.location.toLowerCase().includes(location.toLowerCase())) {
          commonPoints.commonFactors.push({
            type: 'location',
            detail: `Both have connection to ${location}`
          });
        }
      }
    }
    
    if (commonPoints.commonFactors.length > 0) {
      commonConnections.push(commonPoints);
    }
  }
  
  return commonConnections;
}

/**
 * Match executive priorities with seller offerings using AI analysis
 */
async function matchExecutivePriorities(recentNews, sellerOfferings) {
  try {
    const aiService = require('../services/aiService');
    
    const prompt = `
      Analyze the following recent company news and statements:
      ${JSON.stringify(recentNews)}
      
      Extract any strategic priorities or initiatives mentioned by executives.
      Then determine if any of these priorities align with the following offerings:
      ${JSON.stringify(sellerOfferings)}
      
      Format the response as JSON with fields:
      {
        "alignments": [
          {
            "priority": "Executive stated priority",
            "offering": "Matching seller offering",
            "alignmentStrength": "high|medium|low",
            "reason": "Brief explanation of why they align"
          }
        ]
      }
    `;
    
    const analysis = await aiService.generateContent(prompt);
    try {
      const parsedAnalysis = JSON.parse(analysis.replace(/```json|```/g, '').trim());
      return parsedAnalysis.alignments;
    } catch (parseError) {
      console.error('Error parsing AI executive priorities analysis:', parseError);
      return [];
    }
  } catch (error) {
    console.error(`Error analyzing executive priorities: ${error.message}`);
    return [];
  }
}

/**
 * Match technology stack with seller offerings
 */
function matchTechnologyStack(technologies, sellerOfferings) {
  const matches = [];
  
  for (const tech of technologies) {
    for (const offering of sellerOfferings) {
      // Convert both to lowercase for case-insensitive matching
      const techLower = typeof tech === 'string' ? tech.toLowerCase() : 
                         tech.name ? tech.name.toLowerCase() : '';
      const offeringLower = offering.toLowerCase();
      
      // Check for direct matches or related technology matches
      if (techLower.includes(offeringLower) || offeringLower.includes(techLower)) {
        matches.push({
          technology: typeof tech === 'string' ? tech : tech.name,
          offering: offering,
          matchType: 'direct'
        });
      }
    }
  }
  
  return matches;
}

/**
 * Identify geographic expansion opportunities
 */
function identifyGeographicOpportunities(companyLocations, sellerRegions) {
  const opportunities = [];
  
  for (const companyLoc of companyLocations) {
    for (const sellerRegion of sellerRegions) {
      if (typeof companyLoc === 'string' && companyLoc.toLowerCase().includes(sellerRegion.toLowerCase()) ||
          typeof companyLoc === 'object' && companyLoc.name && companyLoc.name.toLowerCase().includes(sellerRegion.toLowerCase())) {
        
        const locationName = typeof companyLoc === 'string' ? companyLoc : companyLoc.name;
        
        opportunities.push({
          location: locationName,
          sellerRegion: sellerRegion,
          opportunity: `Seller has presence in ${sellerRegion} where company operates`
        });
      }
    }
  }
  
  return opportunities;
}

/**
 * Analyze hiring patterns for matches with seller offerings
 */
function analyzeHiringPatterns(jobPostings, sellerOfferings) {
  const matches = [];
  
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
 * Align industry trends with seller offerings
 */
function alignIndustryTrends(industryTrends, sellerOfferings) {
  const alignments = [];
  
  for (const trend of industryTrends) {
    const trendName = trend.name || '';
    const trendDescription = trend.description || '';
    
    for (const offering of sellerOfferings) {
      // Convert to lowercase for case-insensitive matching
      const offeringLower = offering.toLowerCase();
      const trendNameLower = trendName.toLowerCase();
      const trendDescriptionLower = trendDescription.toLowerCase();
      
      if (trendNameLower.includes(offeringLower) || trendDescriptionLower.includes(offeringLower) || 
          offeringLower.includes(trendNameLower)) {
        alignments.push({
          trend: trendName,
          offering: offering,
          alignment: 'Seller offering aligns with industry trend'
        });
      }
    }
  }
  
  return alignments;
}

module.exports = {
  salesCoPilot,
  clearConversationHistory,
  getCompanyInfo,
  getStrategicSalesInsights
};