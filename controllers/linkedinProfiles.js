const exaService = require('../services/exaService');

const searchLinkedInProfiles = async (req, res) => {
  try {
    const { company, position, location, limit = 5, expertise = '', team = '' } = req.body;
    
    if (!company || !position || !location) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required parameters. Please provide company, position, and location.' 
      });
    }
    
    const profiles = await exaService.searchLinkedInProfiles(
      company, 
      position, 
      location, 
      limit,
      expertise,
      team
    );
    
    if (!profiles || profiles.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No LinkedIn profiles found for ${position} at ${company} in ${location}.`
      });
    }
    
    return res.status(200).json({
      success: true,
      message: `Found ${profiles.length} LinkedIn profiles`,
      company,
      position,
      location,
      expertise: expertise || undefined,
      team: team || undefined,
      profiles
    });
  } catch (error) {
    console.error('Error searching LinkedIn profiles:', error);
    return res.status(500).json({
      success: false,
      message: 'Error searching LinkedIn profiles',
      error: error.message
    });
  }
};

module.exports = {
  searchLinkedInProfiles
};