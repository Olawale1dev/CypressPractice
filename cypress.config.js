require("dotenv").config();
const { defineConfig } = require('cypress');
const imap = require("imap-simple");
const cheerio = require("cheerio"); 
const htmlToText = require("html-to-text"); //  Convert HTML to plain text
module.exports = defineConfig({
  reporter: 'mochawesome', // Correct package name
  reporterOptions: {
    reportDir: 'cypress/reports',
    overwrite: false,
    html: true,
    json: true,
    timestamp: "mmddyyyy_HHMMss"
  },

  env: {
    GMAIL_USER: process.env.CYPRESS_GMAIL_USER,
    GMAIL_PASS: process.env.CYPRESS_GMAIL_PASS,
  },

  video: true,
  videoCompression: false,
  videosFolder: 'cypress/videos',
  e2e: {
    specPattern: 'cypress/e2e/lafialink/**.cy.{js,jsx,ts,tsx}', // Adjust if needed
    watchForFileChanges: false, // Corrected spelling
    defaultCommandTimeout: 4000,
    setupNodeEvents(on, config) {
      // implement node event listeners here
      // Expose environment variables
      config.env.GMAIL_USER = process.env.CYPRESS_GMAIL_USER;
      config.env.GMAIL_PASS = process.env.CYPRESS_GMAIL_PASS;

      //  Ignore SSL errors
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

      // Cypress task to retrieve OTP from Gmail

      on("task", {
        async getOTPFromGmail({ email }) {
          console.log(" Fetching OTP for:", email);
          
          const imapConfig = {
            imap: {
              user: config.env.GMAIL_USER,
              password: config.env.GMAIL_PASS,
              host: "imap.gmail.com",
              port: 993,
              tls: true,
              authTimeout: 10000,
              tlsOptions: { rejectUnauthorized: false },
            },
          };
      
          try {
            const connection = await imap.connect(imapConfig);
            await connection.openBox("INBOX");
            
            // Search for emails from the service
            const searchCriteria = [
              ["FROM", "services@seerglobalsolutions.com"],
              ["SUBJECT", "OTP VERIFICATION"]
            ];
            
            const fetchOptions = { bodies: ["HEADER.FIELDS (FROM TO SUBJECT DATE)", "TEXT", ""], markSeen: true };
            const messages = await connection.search(searchCriteria, fetchOptions);
            
            if (messages.length === 0) {
              console.log(" No OTP email found!");
              connection.end();
              return null;
            }
            
            console.log(` ${messages.length} emails found. Processing...`);
            
            // Sort messages by date (newest first)
            messages.sort((a, b) => {
              return new Date(b.parts.find(part => part.which === "HEADER.FIELDS (FROM TO SUBJECT DATE)").body.date[0]) - 
                     new Date(a.parts.find(part => part.which === "HEADER.FIELDS (FROM TO SUBJECT DATE)").body.date[0]);
            });
            
            // Process each message until we find an OTP
            for (const message of messages) {
              // Get the HTML content
              const htmlPart = message.parts.find(part => part.which === "TEXT");
              if (!htmlPart) continue;
              
              const htmlContent = htmlPart.body;
              console.log(" Processing email HTML content...");
              
              // Look for the OTP in the specific HTML structure
              // First try to match the exact structure: <td style="font-weight:bold" bgcolor="#E6E6E6"><span>042012</span></td>
              const specificMatch = htmlContent.match(/<td[^>]*bgcolor="#E6E6E6"[^>]*><span>(\d{6})<\/span><\/td>/i);
              if (specificMatch) {
                const otp = specificMatch[1];
                console.log(" Extracted OTP from specific HTML structure:", otp);
                connection.end();
                return otp;
              }
              
              // Fallback: Look for any 6-digit number after the text "OTP:"
              const otpAfterLabel = htmlContent.match(/OTP:(?:[^0-9]*?)(\d{6})/i);
              if (otpAfterLabel) {
                const otp = otpAfterLabel[1];
                console.log(" Extracted OTP after 'OTP:' label:", otp);
                connection.end();
                return otp;
              }
              
              // Fallback: Any 6-digit number in the email
              const anySixDigits = htmlContent.match(/\b(\d{6})\b/);
              if (anySixDigits) {
                const otp = anySixDigits[1];
                console.log(" Extracted potential OTP (6-digit number):", otp);
                connection.end();
                return otp;
              }
            }
            
            console.log(" Could not extract OTP from any emails");
            connection.end();
            return null;
            
          } catch (error) {
            console.error(" IMAP Error:", error);
            return null;
          }
        },
      });
      return config; // Return updated config
    },
  },
  component: {
    devServer: {
      framework: "react",
      bundler: "webpack",
    },
  },
});