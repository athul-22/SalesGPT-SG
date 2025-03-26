// EXA AI SALESSTRATEGYAPI SERVICE

const axios = require('axios');
require('dotenv').config();

class ExaSearchService {
  constructor() {
    this.apiKey = process.env.EXA_API_KEY;
    if (!this.apiKey) {
      console.error('❌ Exa.ai API key is missing in .env file');
    } else {
      console.log('✅ Exa.ai API key loaded successfully');
    }
  }

  /**
   * Search for company information using Exa.ai
   * @param {string} companyName - Name of the company to search for
   * @returns {Promise<Object>} - Company information
   */
  async searchCompanyInfo(companyName, options = {}) {
    try {
      console.log(`🔍 Searching Exa.ai for information about: ${companyName}`);
      
      // Create a detailed search query based on company name and options
      let searchQuery = `${companyName} company information`;
      if (options.industry) searchQuery += ` ${options.industry} industry`;
      if (options.businessType) searchQuery += ` ${options.businessType}`;
      if (options.targetGeography) searchQuery += ` ${options.targetGeography}`;
      
      // First query: Get basic company information
      const companyInfoResponse = await this.executeExaSearch(
        `${searchQuery} overview, headquarters, size, revenue, business model`
      );
      
      // Second query: Get products/services
      const productsResponse = await this.executeExaSearch(
        `${companyName} products services offerings`
      );
      
      // Third query: Get technology stack
      const techStackResponse = await this.executeExaSearch(
        `${companyName} technology stack, software systems, IT infrastructure`
      );
      
      // Fourth query: Get pain points and market challenges
      const painPointsResponse = await this.executeExaSearch(
        `${companyName} challenges, pain points, market pressures, competition`
      );
      
      // Fifth query: Get competitors
      const competitorsResponse = await this.executeExaSearch(
        `${companyName} main competitors, market position, competitive analysis`
      );

      // Combine all the information into a structured object
      const companyProfile = {
        name: companyName,
        industry: this.extractIndustry(companyInfoResponse, options.industry),
        businessType: this.extractBusinessType(companyInfoResponse, options.businessType),
        headquarters: this.extractHeadquarters(companyInfoResponse, options.targetGeography),
        companySize: this.extractCompanySize(companyInfoResponse),
        productOrServiceDetails: this.extractProducts(productsResponse),
        techStack: this.extractTechStack(techStackResponse),
        painPoints: this.extractPainPoints(painPointsResponse),
        competitors: this.extractCompetitors(competitorsResponse),
        rawData: {
          companyInfo: companyInfoResponse,
          products: productsResponse,
          techStack: techStackResponse,
          painPoints: painPointsResponse,
          competitors: competitorsResponse
        }
      };

      console.log(`✅ Successfully gathered information about ${companyName} from Exa.ai`);
      return companyProfile;
    } catch (error) {
      console.error(`❌ Error searching Exa.ai:`, error);
      throw new Error(`Failed to search Exa.ai: ${error.message}`);
    }
  }

  /**
   * Execute a search query against Exa.ai
   * @param {string} query - The search query
   * @returns {Promise<Object>} - Search results
   */
  async executeExaSearch(query) {
    try {
      console.log(`Querying Exa.ai with: "${query}"`);
      
      const response = await axios({
        method: 'POST',
        url: 'https://api.exa.ai/search',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey
        },
        data: {
          query: query,
          num_results: 5,
          use_autoprompt: true,
          include_domains: [],
          exclude_domains: []
        },
        timeout: 30000 // 30 second timeout
      });
      
      return response.data;
    } catch (error) {
      console.error(`Error in Exa.ai search:`, error.message);
      if (error.response) {
        console.error(`Status: ${error.response.status}`);
        console.error(`Data:`, error.response.data);
      }
      throw error;
    }
  }

  /**
   * Extract industry information from Exa.ai response
   */
  extractIndustry(companyInfoResponse, fallbackIndustry) {
    try {
      // If we have a results array with content
      if (companyInfoResponse.results && companyInfoResponse.results.length > 0) {
        // Combine all text from results
        const allText = companyInfoResponse.results
          .map(result => result.text)
          .join(' ');
        
        // Look for industry indicators
        const industryPatterns = [
          /industry:?\s*([^\.;,\n]+)/i,
          /operates in (?:the|)\s*([^\.;,\n]+) industry/i,
          /operates in (?:the|)\s*([^\.;,\n]+) sector/i,
          /(?:a|an) ([^\.;,\n]+) company/i,
          /primarily in (?:the|)\s*([^\.;,\n]+) sector/i
        ];
        
        for (const pattern of industryPatterns) {
          const match = allText.match(pattern);
          if (match && match[1]) {
            return match[1].trim();
          }
        }
      }
      
      // Return fallback or default value
      return fallbackIndustry || "Technology";
    } catch (error) {
      console.error("Error extracting industry:", error);
      return fallbackIndustry || "Technology";
    }
  }

  /**
   * Extract business type from Exa.ai response
   */
  extractBusinessType(companyInfoResponse, fallbackBusinessType) {
    try {
      if (companyInfoResponse.results && companyInfoResponse.results.length > 0) {
        const allText = companyInfoResponse.results
          .map(result => result.text)
          .join(' ');
        
        // Look for business type indicators
        const businessTypePatterns = [
          /business (?:type|model):?\s*([^\.;,\n]+)/i,
          /operates as (?:a|an)\s*([^\.;,\n]+)/i,
          /is (?:a|an) ([^\.;,\n]+) business/i,
          /(?:a|an) ([^\.;,\n]+) business model/i
        ];
        
        for (const pattern of businessTypePatterns) {
          const match = allText.match(pattern);
          if (match && match[1]) {
            return match[1].trim();
          }
        }
      }
      
      return fallbackBusinessType || "Services";
    } catch (error) {
      console.error("Error extracting business type:", error);
      return fallbackBusinessType || "Services";
    }
  }

  /**
   * Extract headquarters information from Exa.ai response
   */
  extractHeadquarters(companyInfoResponse, fallbackLocation) {
    try {
      if (companyInfoResponse.results && companyInfoResponse.results.length > 0) {
        const allText = companyInfoResponse.results
          .map(result => result.text)
          .join(' ');
        
        // Look for headquarters indicators
        const hqPatterns = [
          /headquarters:?\s*([^\.;,\n]+)/i,
          /headquartered in\s*([^\.;,\n]+)/i,
          /based in\s*([^\.;,\n]+)/i,
          /located in\s*([^\.;,\n]+)/i,
          /offices? in\s*([^\.;,\n]+)/i
        ];
        
        for (const pattern of hqPatterns) {
          const match = allText.match(pattern);
          if (match && match[1]) {
            return match[1].trim();
          }
        }
      }
      
      return fallbackLocation || "United States";
    } catch (error) {
      console.error("Error extracting headquarters:", error);
      return fallbackLocation || "United States";
    }
  }

  /**
   * Extract company size information from Exa.ai response
   */
  extractCompanySize(companyInfoResponse) {
    try {
      let employeeCount = "Unknown";
      let annualRevenue = "Unknown";
      
      if (companyInfoResponse.results && companyInfoResponse.results.length > 0) {
        const allText = companyInfoResponse.results
          .map(result => result.text)
          .join(' ');
        
        // Extract employee count
        const employeePatterns = [
          /(\d+[\d,\.]*\+?)\s*employees/i,
          /employs\s*(\d+[\d,\.]*\+?)/i,
          /workforce of\s*(\d+[\d,\.]*\+?)/i,
          /staff of\s*(\d+[\d,\.]*\+?)/i
        ];
        
        for (const pattern of employeePatterns) {
          const match = allText.match(pattern);
          if (match && match[1]) {
            employeeCount = match[1].trim();
            break;
          }
        }
        
        // Extract revenue
        const revenuePatterns = [
          /revenue:?\s*\$?(\d+\.?\d*\s*[bmtk]illion)/i,
          /revenue of\s*\$?(\d+\.?\d*\s*[bmtk]illion)/i,
          /generates\s*\$?(\d+\.?\d*\s*[bmtk]illion)/i,
          /\$(\d+\.?\d*\s*[bmtk]illion) in revenue/i
        ];
        
        for (const pattern of revenuePatterns) {
          const match = allText.match(pattern);
          if (match && match[1]) {
            annualRevenue = match[1].trim();
            break;
          }
        }
      }
      
      return {
        employeeCount,
        annualRevenue
      };
    } catch (error) {
      console.error("Error extracting company size:", error);
      return {
        employeeCount: "Unknown",
        annualRevenue: "Unknown"
      };
    }
  }

  /**
   * Extract products/services from Exa.ai response
   */
  extractProducts(productsResponse) {
    try {
      const products = [];
      
      if (productsResponse.results && productsResponse.results.length > 0) {
        const allText = productsResponse.results
          .map(result => result.text)
          .join(' ');
        
        // Look for product lists
        const productListPatterns = [
          /products include:?\s*([^\.]+)/i,
          /services include:?\s*([^\.]+)/i,
          /offerings include:?\s*([^\.]+)/i,
          /main products are:?\s*([^\.]+)/i
        ];
        
        for (const pattern of productListPatterns) {
          const match = allText.match(pattern);
          if (match && match[1]) {
            const potentialProducts = match[1].split(/,|and/).map(item => item.trim());
            products.push(...potentialProducts);
          }
        }
        
        // If no explicit lists found, try to extract from sentences
        if (products.length === 0) {
          const sentences = allText.split(/\.|\n/).filter(Boolean);
          
          for (const sentence of sentences) {
            if (
              sentence.toLowerCase().includes("product") || 
              sentence.toLowerCase().includes("service") || 
              sentence.toLowerCase().includes("offering")
            ) {
              // Extract nouns that might be products
              const nouns = sentence.match(/([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)/g);
              if (nouns && nouns.length > 0) {
                products.push(...nouns.filter(noun => noun.length > 3));
              }
            }
          }
        }
      }
      
      // Remove duplicates and limit to reasonable number
      return [...new Set(products)].slice(0, 8);
    } catch (error) {
      console.error("Error extracting products:", error);
      return ["Product information not available"];
    }
  }

  /**
   * Extract tech stack from Exa.ai response
   */
  extractTechStack(techStackResponse) {
    try {
      const techStack = [];
      
      if (techStackResponse.results && techStackResponse.results.length > 0) {
        const allText = techStackResponse.results
          .map(result => result.text)
          .join(' ');
        
        // Look for tech stack lists or mentions
        const techStackPatterns = [
          /technology stack includes:?\s*([^\.]+)/i,
          /technologies include:?\s*([^\.]+)/i,
          /uses:?\s*([^\.]+) for/i,
          /employs:?\s*([^\.]+) for/i,
          /platform is built on:?\s*([^\.]+)/i
        ];
        
        for (const pattern of techStackPatterns) {
          const match = allText.match(pattern);
          if (match && match[1]) {
            const technologies = match[1].split(/,|and/).map(item => item.trim());
            techStack.push(...technologies);
          }
        }
        
        // Extract tech words (common tech terms)
        const techTerms = [
          'AWS', 'Azure', 'Google Cloud', 'GCP', 'Oracle', 'SAP', 'Salesforce', 
          'Java', 'Python', 'JavaScript', 'React', 'Angular', 'Vue', 'Node.js',
          'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Elasticsearch',
          'Docker', 'Kubernetes', 'CI/CD', 'DevOps', 'AI', 'ML', 'Big Data',
          'Hadoop', 'Spark', 'Tableau', 'Power BI', 'Looker', 'CRM', 'ERP'
        ];
        
        for (const term of techTerms) {
          if (allText.includes(term) && !techStack.includes(term)) {
            techStack.push(term);
          }
        }
      }
      
      // Remove duplicates and limit to reasonable number
      return [...new Set(techStack)].slice(0, 5);
    } catch (error) {
      console.error("Error extracting tech stack:", error);
      return ["Tech stack information not available"];
    }
  }

  /**
   * Extract pain points from Exa.ai response
   */
  extractPainPoints(painPointsResponse) {
    try {
      const painPoints = [];
      
      if (painPointsResponse.results && painPointsResponse.results.length > 0) {
        const allText = painPointsResponse.results
          .map(result => result.text)
          .join(' ');
        
        // Look for pain point indicators
        const painPointPatterns = [
          /challenges include:?\s*([^\.]+)/i,
          /facing\s*([^\.]+) challenges/i,
          /struggles with\s*([^\.]+)/i,
          /issues with\s*([^\.]+)/i,
          /concerned about\s*([^\.]+)/i,
          /problems with\s*([^\.]+)/i
        ];
        
        for (const pattern of painPointPatterns) {
          const match = allText.match(pattern);
          if (match && match[1]) {
            const points = match[1].split(/,|and/).map(item => item.trim());
            painPoints.push(...points);
          }
        }
        
        // If no explicit mentions, try to identify sentences about challenges
        if (painPoints.length === 0) {
          const sentences = allText.split(/\.|\n/).filter(Boolean);
          
          for (const sentence of sentences) {
            if (
              sentence.toLowerCase().includes("challenge") || 
              sentence.toLowerCase().includes("problem") || 
              sentence.toLowerCase().includes("struggle") ||
              sentence.toLowerCase().includes("issue") ||
              sentence.toLowerCase().includes("facing") ||
              sentence.toLowerCase().includes("difficulty")
            ) {
              painPoints.push(sentence.trim());
            }
          }
        }
      }
      
      // Clean up, remove duplicates, and limit to reasonable number
      return [...new Set(painPoints)]
        .map(point => point.replace(/^[,\s]+|[,\s]+$/g, ''))
        .filter(point => point.length > 10)
        .slice(0, 3);
    } catch (error) {
      console.error("Error extracting pain points:", error);
      return ["Pain point information not available"];
    }
  }

  /**
   * Extract competitors from Exa.ai response
   */
  extractCompetitors(competitorsResponse) {
    try {
      const competitors = [];
      
      if (competitorsResponse.results && competitorsResponse.results.length > 0) {
        const allText = competitorsResponse.results
          .map(result => result.text)
          .join(' ');
        
        // Look for competitor lists
        const competitorPatterns = [
          /competitors include:?\s*([^\.]+)/i,
          /competes with:?\s*([^\.]+)/i,
          /main competitors are:?\s*([^\.]+)/i,
          /competition includes:?\s*([^\.]+)/i,
          /rivals include:?\s*([^\.]+)/i
        ];
        
        for (const pattern of competitorPatterns) {
          const match = allText.match(pattern);
          if (match && match[1]) {
            const names = match[1].split(/,|and/).map(item => item.trim());
            competitors.push(...names);
          }
        }
        
        // Extract company names (assuming they start with capital letters)
        if (competitors.length === 0) {
          const companyNamePattern = /([A-Z][a-z]+(?:\s[A-Z][a-z]+)*(?:\s+Inc\.?|Corp\.?|LLC|Ltd\.?|Limited)?)/g;
          const potentialNames = allText.match(companyNamePattern);
          
          if (potentialNames) {
            // Filter common non-company words that might match the pattern
            const commonWords = ['The', 'They', 'These', 'Those', 'Their', 'This', 'That'];
            competitors.push(
              ...potentialNames
                .filter(name => !commonWords.includes(name) && name.length > 3)
                .slice(0, 5)
            );
          }
        }
      }
      
      // Remove duplicates and limit to reasonable number
      return [...new Set(competitors)]
        .map(name => name.replace(/^[,\s]+|[,\s]+$/g, ''))
        .filter(name => name.length > 2 && !/^(The|A|An)$/i.test(name))
        .slice(0, 3);
    } catch (error) {
      console.error("Error extracting competitors:", error);
      return ["Competitor information not available"];
    }
  }
}

module.exports = new ExaSearchService();