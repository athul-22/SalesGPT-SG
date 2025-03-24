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
    const { company, query, userId, user_data = [] } = req.body;

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
      const docResults = await chromaService.queryAllDocumentCollections(
        `${company} ${query}`, 
        3
      );
      
      if (docResults && docResults.documents && docResults.documents[0]) {
        // Extract relevant text from documents
        documentContext = docResults.documents[0].join("\n\n").substring(0, 2000);
        console.log(`Found relevant document information: ${documentContext.length} characters`);
      }
    } catch (error) {
      documentError = `Error searching document database: ${error.message || error}`;
      console.error(documentError);
    }

    // Format conversation history for the AI
    const conversationLog = conversationHistory.map(entry => 
      `User: ${entry.query}\nAI: ${entry.response}`
    ).join('\n\n');

    // Construct prompt for AI service
    const prompt = `
      You are an AI sales co-pilot assistant, helping a sales professional engage with ${company}.
      
      COMPANY INFORMATION:
      ${JSON.stringify(companyInfo, null, 2)}
      ${companyError ? `NOTE: ${companyError}` : ''}
      
      RELEVANT DOCUMENT EXCERPTS:
      ${documentContext}
      ${documentError ? `NOTE: ${documentError}` : ''}
      
      CONVERSATION HISTORY:
      ${conversationLog}
      
      USER QUERY: ${query}
      
      Provide a helpful, concise response addressing the user's query based on the available information.
      If there were errors retrieving company information, acknowledge this in your response.
      Then, suggest 3 relevant follow-up questions the user might want to ask next.
      
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

module.exports = {
  salesCoPilot,
  clearConversationHistory
};