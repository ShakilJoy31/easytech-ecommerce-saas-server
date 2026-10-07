// utils/helper/sendSMS.js
const axios = require("axios");

const sendSMSHelper = async (phoneNumber, message, apiKey, senderId, type = "text", baseUrl = "https://msg.mram.com.bd/smsapi") => {
  try {
    // Clean phone number (remove any non-digit characters)
    const cleanPhoneNumber = phoneNumber.replace(/\D/g, '');

    // Validate phone number
    if (!cleanPhoneNumber || cleanPhoneNumber.length < 10 || cleanPhoneNumber.length > 15) {
      return {
        success: false,
        message: `Invalid phone number: ${phoneNumber}`,
        phoneNumber
      };
    }

    // Validate message
    if (!message || message.trim() === '') {
      return {
        success: false,
        message: "Message cannot be empty",
        phoneNumber
      };
    }

    // Prepare API parameters
    const params = new URLSearchParams({
      api_key: apiKey,
      type: type,
      contacts: cleanPhoneNumber,
      senderid: senderId,
      msg: message
    });

    // Construct API URL
    const apiUrl = `${baseUrl}?${params.toString()}`;

    // Send SMS via API
    const response = await axios.get(apiUrl, {
      timeout: 10000, // 10 second timeout
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    // Parse response based on common SMS gateway formats
    let parsedResponse = {
      success: false,
      message: '',
      response: response.data,
      messageId: null
    };

    // Handle different response formats
    if (typeof response.data === 'string') {
      const responseText = response.data.toLowerCase();
      
      if (responseText.includes('sms submitted') || 
          responseText.includes('success') || 
          responseText.includes('sent') ||
          responseText.includes('100') ||
          responseText.includes('ok')) {
        parsedResponse.success = true;
        parsedResponse.message = 'SMS sent successfully';
        
        // Extract message ID from response if available
        const idMatch = response.data.match(/(?:message[_-]?id|request[_-]?id|id)[:=]\s*(\w+)/i);
        if (idMatch) {
          parsedResponse.messageId = idMatch[1];
        }
      } else {
        // Parse error response
        const errorMatch = response.data.match(/error[:\s]+(.+)/i);
        parsedResponse.message = errorMatch ? errorMatch[1] : `SMS sending failed: ${response.data}`;
      }
    } else if (typeof response.data === 'object') {
      const responseData = response.data;
      
      if (responseData.status === 'SUCCESS' || 
          responseData.success === true || 
          responseData.error_code === '100' ||
          responseData.code === 100 ||
          responseData.response_code === '100') {
        parsedResponse.success = true;
        parsedResponse.message = responseData.message || 'SMS sent successfully';
        parsedResponse.messageId = responseData.message_id || responseData.request_id || responseData.id;
      } else {
        parsedResponse.message = responseData.message || responseData.error || 'SMS sending failed';
      }
    }

    return {
      ...parsedResponse,
      phoneNumber: cleanPhoneNumber,
      messageLength: message.length,
      senderId,
      type,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('SMS Helper Error:', error.message);
    
    let errorMessage = 'Failed to send SMS';
    
    if (error.response) {
      errorMessage = `SMS gateway error: ${error.response.status}`;
      if (error.response.data) {
        errorMessage += ` - ${JSON.stringify(error.response.data)}`;
      }
    } else if (error.request) {
      errorMessage = 'No response from SMS gateway. Please check your network connection.';
    } else if (error.code === 'ECONNABORTED') {
      errorMessage = 'SMS gateway request timeout';
    } else if (error.message) {
      errorMessage = `SMS sending error: ${error.message}`;
    }

    return {
      success: false,
      message: errorMessage,
      phoneNumber,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
};

module.exports = {
  sendSMSHelper
};