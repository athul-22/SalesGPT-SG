const organizationService = require('../services/organizationService');
const aiService = require('../services/aiService');
const chromaService = require('../services/chromaService');

// In-memory stores for conversations and company data
const conversationStore = {};
const companyDataStore = {}; 
const lastActivity = {}; 

/**
 * Enhanced Sales Co-Pilot API that enables conversational interaction about target companies
 * with comprehensive data handling and knowledge base integration
 */
const salesCoPilot = async (req, res) => {
  try {
    const { 
      company, 
      query, 
      userId, 
      user_data = [], 
      userProfile = {}, 
      userContext = {},
      companyData = null,
      conversationHistory = null, 
      forceRefresh = false
    } = req.body;

    // Validation
    if (!company || !query || !userId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters. Please provide company, query, and userId.'
      });
    }

    console.log(`\n===== SALES CO-PILOT REQUEST =====`);
    console.log(`👤 User: ${userId}`);
    console.log(`🏢 Company: ${company}`);
    console.log(`💬 Query: ${query}`);
    console.log(`📊 Has companyData: ${companyData ? 'Yes' : 'No'}`);
    console.log(`👱 Has userProfile: ${Object.keys(userProfile).length > 0 ? 'Yes' : 'No'}`);
    
    // Update last activity timestamp for this user
    lastActivity[userId] = Date.now();

    // Initialize stores for this user if needed
    if (!conversationStore[userId]) {
      conversationStore[userId] = {};
    }
    
    if (!companyDataStore[userId]) {
      companyDataStore[userId] = {};
    }
    
    // Initialize conversation history for this company
    if (!conversationStore[userId][company]) {
      conversationStore[userId][company] = [];
    }
    
    // If client provided conversation history, use it instead of server-stored history
    if (conversationHistory && Array.isArray(conversationHistory) && conversationHistory.length > 0) {
      console.log(`📝 Using client-provided conversation history (${conversationHistory.length} entries)`);
      conversationStore[userId][company] = conversationHistory;
    }
    
    // Handle company data - either from the request or from storage
    let companyInfo = {};
    let companyError = null;
    
    // If company data is provided in this request, use and store it
    if (companyData && Object.keys(companyData).length > 0) {
      companyDataStore[userId][company] = companyData;
      companyInfo = companyData;
      console.log(`📋 Using and storing new company data (${Object.keys(companyData).length} fields)`);
    } 
    // Otherwise use previously stored data if available
    else if (companyDataStore[userId] && companyDataStore[userId][company] && !forceRefresh) {
      companyInfo = companyDataStore[userId][company];
      console.log(`📚 Using cached company data from previous requests`);
    } 
    // No data found
    else {
      companyError = `No company information available for: ${company}`;
      console.log(`⚠️ ${companyError}`);
    }

    const activeConversationHistory = conversationStore[userId][company];
    
    // Prepare user-related context from both user_data and userProfile
    const enrichedUserProfile = {
      ...userProfile,
      additionalData: user_data
    };

    // Search document database for relevant information with enhanced search terms
    console.log(`\n===== KNOWLEDGE BASE SEARCH =====`);
    let documentContext = "";
    let documentError = null;
    try {
      // Create a comprehensive search query using company, query, and sales domain context
      let searchTerms = [`${company}`, `${query}`];
      
      // Add user profile and context details to enhance search relevance
      if (userProfile && userProfile.industry) {
        searchTerms.push(userProfile.industry);
      }
      
      if (userProfile && userProfile.businessType) {
        searchTerms.push(userProfile.businessType);
      }
      
      // Add sales-specific terms to focus on sales strategy content
      const salesTerms = ["sales strategy", "sales approach", "business development", "sales techniques"];
      
      // Select relevant sales terms based on the query
      const relevantSalesTerms = salesTerms.filter(term => 
        query.toLowerCase().includes(term.split(" ")[0].toLowerCase())
      );
      
      if (relevantSalesTerms.length > 0) {
        searchTerms = [...searchTerms, ...relevantSalesTerms];
      }
      
      // Add any user_data to the search context if available
      if (user_data && user_data.length > 0) {
        console.log(`👤 Enhancing search with user data context`);
        searchTerms.push(...user_data);
      }
      
      // Join with spaces and remove any double spaces
      const searchQuery = searchTerms.join(' ').replace(/\s+/g, ' ').trim();
      console.log(`🔍 ChromaDB search query: "${searchQuery}"`);
      
      // Query ChromaDB with enhanced search
      let docResults = null;
      try {
        // Define specialized collections to search based on query content
        const salesCollections = ["sales_strategy", "business_development", "sales_techniques"];
        
        // Search with higher limit to get more content
        docResults = await chromaService.queryAllDocumentCollections(searchQuery, 8);
        console.log(`📊 ChromaDB search results: ${docResults?.documents?.length || 0} documents found`);
        
        // If we have very few results from all collections, try searching specifically sales collections
        if ((!docResults || !docResults.documents || docResults.documents.length < 2) && 
            query.toLowerCase().includes("sales") || 
            query.toLowerCase().includes("strategy")) {
          
          console.log(`🔍 Searching sales-specific collections for better results`);
          const salesResults = await chromaService.querySpecificCollections(searchQuery, salesCollections, 5);
          
          if (salesResults && salesResults.documents && salesResults.documents.length > 0) {
            console.log(`✅ Found ${salesResults.documents.length} results in sales collections`);
            docResults = salesResults;
          }
        }
      } catch (chromaError) {
        console.error(`❌ ChromaDB search error: ${chromaError.message}`);
        documentError = `ChromaDB search error: ${chromaError.message}`;
      }
      
      // Process and format search results
      if (docResults && docResults.documents && docResults.documents.length > 0) {
        // Handle different result structures that might come back
        let relevantDocs = [];
        
        if (Array.isArray(docResults.documents)) {
          if (Array.isArray(docResults.documents[0])) {
            // If documents is an array of arrays
            relevantDocs = docResults.documents.flat();
          } else {
            // If documents is a simple array
            relevantDocs = docResults.documents;
          }
        }
        
        if (relevantDocs.length > 0) {
          // Extract text content from documents
          const texts = relevantDocs.map(doc => {
            if (typeof doc === 'string') return doc;
            if (doc && doc.text) return doc.text;
            if (doc && doc.document) return doc.document;
            return JSON.stringify(doc).substring(0, 100);
          });
          
          // Format document context with source attribution if available
          const formattedDocs = texts.map((text, index) => {
            const source = docResults.metadatas && docResults.metadatas[index] ? 
              docResults.metadatas[index].source || "Knowledge Base" : 
              "Knowledge Base";
            
            return `[Source: ${source}]\n${text}`;
          });
          
          // Prioritize more relevant documents by limiting to first 3000 characters
          documentContext = formattedDocs.join("\n\n").substring(0, 3000);
          console.log(`📄 Found ${formattedDocs.length} relevant documents (${documentContext.length} chars)`);
        }
      } else {
        console.log(`⚠️ No matching documents found in knowledge base`);
        documentContext = "No relevant documents found in the knowledge base.";
      }
    } catch (error) {
      documentError = `Error searching document database: ${error.message || error}`;
      console.error(`❌ Knowledge base search error: ${error}`);
    }

    // Format conversation history for the AI
    console.log(`\n===== CONVERSATION CONTEXT =====`);
    const conversationLog = activeConversationHistory.map(entry => 
      `User: ${entry.query}\nAI: ${entry.response}`
    ).join('\n\n');
    console.log(`📝 Using ${activeConversationHistory.length} previous conversation entries`);

    // Construct optimized prompt for AI service
    const prompt = `
      You are an AI sales co-pilot assistant, helping a sales professional engage with ${company}.
      Answer queries based on both the company data provided and knowledge base documents.
      
      ${enrichedUserProfile && Object.keys(enrichedUserProfile).length > 0 ? 
        `SALES REPRESENTATIVE PROFILE:
        Name: ${enrichedUserProfile.name || 'Sales Representative'}
        Role: ${enrichedUserProfile.role || 'Sales Professional'}
        Company: ${enrichedUserProfile.company || 'Our Company'}
        Business Type: ${enrichedUserProfile.businessType || 'Service/Product Provider'}
        Industry Focus: ${enrichedUserProfile.industry || 'Technology Solutions'}
        Location: ${enrichedUserProfile.location || 'Global'}
        ${enrichedUserProfile.education ? `Education: ${JSON.stringify(enrichedUserProfile.education)}` : ''}
        ${enrichedUserProfile.previousEmployers ? `Previous Employers: ${JSON.stringify(enrichedUserProfile.previousEmployers)}` : ''}` : ''}
      
      ${userContext && userContext.productDescription ? 
        `YOUR PRODUCT/SERVICE OFFERING:
        ${userContext.productDescription}
        ${userContext.sellerOfferings ? `Products/Services: ${JSON.stringify(userContext.sellerOfferings)}` : ''}` : ''}
      
      COMPANY INFORMATION:
      ${Object.keys(companyInfo).length > 0 ? 
        JSON.stringify(companyInfo, null, 2) : 
        "No structured company information available."}
      ${companyError ? `NOTE: ${companyError}` : ''}
      
      RELEVANT KNOWLEDGE BASE DOCUMENTS ABOUT SALES STRATEGIES AND THIS COMPANY:
      ${documentContext ? documentContext : "No relevant documents found in knowledge base."}
      ${documentError ? `NOTE: ${documentError}` : ''}
      
      CONVERSATION HISTORY:
      ${conversationLog || "This is the start of the conversation."}
      
      USER QUERY: ${query}
      
      First, determine if you have sufficient information to answer the query effectively. If not, acknowledge what's missing.
      
      Then, provide a helpful, structured response that:
      1. Draws from both the company data AND knowledge base documents when relevant
      2. Clearly indicates when information comes from our knowledge base versus company data
      3. Addresses the specific question without unnecessary information
      4. When appropriate, suggests practical sales approaches based on the knowledge base content
      5. When relevant, connects the sales professional's offerings to the company's needs or challenges
      6. Provides specific, actionable advice when the query is about sales strategy
      
      Finally, suggest 3 relevant follow-up questions the user might want to ask next.
      
      Format your response as JSON with the following structure:
      {
        "response": "Your detailed answer here",
        "followUpQuestions": ["Question 1?", "Question 2?", "Question 3?"]
      }
    `;

    // Generate AI response
    console.log(`\n===== GENERATING AI RESPONSE =====`);
    const aiResult = await aiService.generateContent(prompt);
    
    // Parse AI response (handle potential JSON parsing issues)
    let parsedResponse;
    try {
      // Clean up the response in case it has markdown code blocks
      const cleanedResponse = aiResult.replace(/```json|```/g, '').trim();
      parsedResponse = JSON.parse(cleanedResponse);
      console.log(`✅ Successfully parsed AI response`);
    } catch (parseError) {
      console.error(`❌ Error parsing AI response: ${parseError.message}`);
      
      // Fallback for invalid JSON responses
      parsedResponse = {
        response: aiResult,
        followUpQuestions: [
          "Can you tell me more about this company's challenges?",
          "What sales strategies would work best for this industry?",
          "How can I align my solution to their business needs?"
        ]
      };
    }

    // Store this interaction in conversation history
    activeConversationHistory.push({
      query,
      response: parsedResponse.response,
      timestamp: new Date().toISOString()
    });

    // Limit history size to prevent memory issues (keep last 15 interactions)
    if (activeConversationHistory.length > 15) {
      activeConversationHistory.shift();
    }

    console.log(`\n===== RESPONSE COMPLETE =====`);
    
    // Return enriched response with metadata
    return res.status(200).json({
      success: true,
      response: parsedResponse.response,
      followUpQuestions: parsedResponse.followUpQuestions,
      conversationHistory: activeConversationHistory,
      metadata: {
        timestamp: new Date().toISOString(),
        company: company,
        userId: userId,
        hasCompanyData: Object.keys(companyInfo).length > 0,
        conversationLength: activeConversationHistory.length
      },
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
 * Clear conversation history and company data for a user
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
        // Clear specific company conversation and data
        conversationStore[userId][company] = [];
        if (companyDataStore[userId] && companyDataStore[userId][company]) {
          delete companyDataStore[userId][company];
        }
        console.log(`Cleared conversation history for user ${userId} and company ${company}`);
      } else {
        // Clear all conversations and data for this user
        conversationStore[userId] = {};
        companyDataStore[userId] = {};
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

/**
 * Get company information from multiple sources
 */
const getCompanyInfo = async (req, res) => {
  try {
    const { company, useExaAi = false, userId, companyData = {} } = req.body;
    
    if (!company) {
      return res.status(400).json({
        success: false,
        message: 'Company name is required'
      });
    }
    
    // Use company data from payload
    let companyInfo = companyData;
    let companyError = null;
    
    if (!companyInfo || Object.keys(companyInfo).length === 0) {
      companyError = `No company information provided in payload`;
    }
    
    // If requested and no payload data, try Exa.ai as fallback
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

/**
 * Get strategic sales insights for a company
 */
const getStrategicSalesInsights = async (req, res) => {
  try {
    const { company, userId, companyData = {}, userProfile = {} } = req.body;
    
    if (!company) {
      return res.status(400).json({
        success: false,
        message: 'Company name is required'
      });
    }
    
    console.log(`\n===== GENERATING STRATEGIC SALES INSIGHTS =====`);
    console.log(`🏢 Company: ${company}`);
    console.log(`👤 User: ${userId || 'Anonymous'}`);
    
    // Use company data from payload
    if (!companyData || Object.keys(companyData).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Company data is required'
      });
    }

    // Extract key information
    const companyInsights = {
      name: company,
      industry: companyData.industry || 'Unknown',
      businessType: companyData.businessType || 'Unknown',
      technologies: companyData.technologies_used || [],
      decisionMakers: companyData.decison_makers || [],
      influencers: companyData.decison_influencers || [],
      hiringTrends: companyData.hiring_trends || []
    };
    
    // Get relevant insights
    const strategicInsights = {};
    
    // 1. Technology stack matches
    if (userProfile.sellerOfferings && companyInsights.technologies.length > 0) {
      strategicInsights.technologyMatches = companyInsights.technologies
        .filter(tech => userProfile.sellerOfferings.some(
          offering => tech.toLowerCase().includes(offering.toLowerCase()) || 
                    offering.toLowerCase().includes(tech.toLowerCase())
        ))
        .map(tech => ({
          technology: tech,
          relevance: `${tech} aligns with your offerings`
        }));
    } else {
      strategicInsights.technologyMatches = [];
    }
    
    // 2. Hiring needs analysis
    if (companyInsights.hiringTrends && companyInsights.hiringTrends.length > 0) {
      strategicInsights.hiringInsights = companyInsights.hiringTrends
        .filter(job => userProfile.sellerOfferings && userProfile.sellerOfferings.some(
          offering => (job.title && job.title.toLowerCase().includes(offering.toLowerCase())) || 
                    (job.description && job.description.toLowerCase().includes(offering.toLowerCase()))
        ))
        .map(job => ({
          position: job.title,
          insight: `${job.title} indicates need for ${job.description ? job.description.substring(0, 50) + '...' : 'related solutions'}`
        }));
    } else {
      strategicInsights.hiringInsights = [];
    }
    
    // 3. Company challenges (based on industry)
    strategicInsights.companyChallenges = getIndustryChallenges(companyInsights.industry);
    
    // Return the insights
    return res.status(200).json({
      success: true,
      company,
      strategicInsights
    });
  } catch (error) {
    console.error('Error getting strategic sales insights:', error);
    return res.status(500).json({
      success: false,
      message: 'Error processing request',
      error: error.message
    });
  }
};

/**
 * Helper function to get industry-specific challenges
 */
function getIndustryChallenges(industry) {
  const industryLower = (industry || '').toLowerCase();
  
  // Common challenges by industry
  const challengesByIndustry = {
    'technology': [
      'Rapid technological obsolescence',
      'Talent acquisition and retention',
      'Cybersecurity threats',
      'Digital transformation costs'
    ],
    'financial': [
      'Regulatory compliance',
      'Digital disruption',
      'Data security and privacy',
      'Legacy system integration'
    ],
    'healthcare': [
      'Cost containment pressures',
      'Regulatory compliance',
      'Digital transformation',
      'Patient data security'
    ],
    'retail': [
      'E-commerce competition',
      'Supply chain disruptions',
      'Changing consumer behaviors',
      'Omnichannel integration'
    ],
    'manufacturing': [
      'Supply chain resilience',
      'Automation and workforce transitions',
      'Sustainability requirements',
      'Digital transformation costs'
    ]
  };
  
  // Find relevant challenges
  for (const [key, challenges] of Object.entries(challengesByIndustry)) {
    if (industryLower.includes(key)) {
      return challenges;
    }
  }
  
  // Default challenges if no industry match
  return [
    'Digital transformation',
    'Cost optimization',
    'Talent acquisition and retention',
    'Competitive pressures'
  ];
}

// Add the new function to exports 
module.exports = {
  salesCoPilot,
  clearConversationHistory,
  getCompanyInfo,
  getStrategicSalesInsights
};