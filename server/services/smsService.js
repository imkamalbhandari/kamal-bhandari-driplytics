const axios = require('axios');

/**
 * SMS Service using Textbelt API
 * 
 * Free tier: 1 SMS/day with key "textbelt"
 * Paid tier: $0.01/text — get a key at https://textbelt.com
 * 
 * Set TEXTBELT_API_KEY in .env for paid usage, otherwise defaults to free "textbelt" key.
 */

const TEXTBELT_API_KEY = process.env.TEXTBELT_API_KEY || 'textbelt';

/**
 * Send an SMS via Textbelt
 * @param {string} phoneNumber - Recipient phone number (e.g. +1234567890)
 * @param {string} message - Text message body (max ~160 chars for 1 segment)
 * @returns {Promise<{success: boolean, textId?: string, error?: string, quotaRemaining?: number}>}
 */
async function sendSMS(phoneNumber, message) {
  try {
    if (!phoneNumber) {
      return { success: false, error: 'No phone number provided' };
    }

    // Normalize phone number — ensure it starts with +
    let normalized = phoneNumber.replace(/[\s\-\(\)]/g, '');
    if (!normalized.startsWith('+')) {
      // Assume US number if no country code
      if (normalized.length === 10) {
        normalized = '+1' + normalized;
      } else {
        normalized = '+' + normalized;
      }
    }

    console.log(`[SMS] Sending to ${normalized}...`);

    const response = await axios.post('https://textbelt.com/text', {
      phone: normalized,
      message: message,
      key: TEXTBELT_API_KEY,
    }, { timeout: 15000 });

    const data = response.data;

    if (data.success) {
      console.log(`[SMS] Sent successfully to ${normalized} (textId: ${data.textId}, quota remaining: ${data.quotaRemaining})`);
      return {
        success: true,
        textId: data.textId,
        quotaRemaining: data.quotaRemaining,
      };
    } else {
      console.error(`[SMS] Failed to send to ${normalized}: ${data.error}`);
      return {
        success: false,
        error: data.error || 'Unknown error from Textbelt',
        quotaRemaining: data.quotaRemaining,
      };
    }
  } catch (error) {
    console.error('[SMS] Error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Send a price alert SMS
 * @param {string} phoneNumber 
 * @param {object} alertData  { sneakerName, targetPrice, predictedPrice, alertType, direction }
 */
async function sendAlertSMS(phoneNumber, alertData) {
  const { sneakerName, targetPrice, predictedPrice, direction } = alertData;
  const action = alertData.alertType === 'below' ? 'BUY' : 'SELL';

  const message = `Driplytics Alert: ${sneakerName} price has ${direction} your target of $${targetPrice}. Predicted: $${predictedPrice.toFixed(2)}. ${action} opportunity! Check the app for details.`;

  return sendSMS(phoneNumber, message);
}

module.exports = {
  sendSMS,
  sendAlertSMS,
};
