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

// Add this new function
/**
 * Get company information from multiple sources
 */
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

// Add to exports
module.exports = {
  salesCoPilot,
  clearConversationHistory,
  getCompanyInfo
};