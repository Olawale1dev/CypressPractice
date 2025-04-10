/// <reference types="cypress" />

describe('Lafialink Signup Page', () => {
  beforeEach(() => {
      cy.visit('https://auth.lafialink-dev.com/signup');
  });

  it('Registration with Auto-Generated Data', () => {
      // Generate random user data
      const firstName = `User${Math.floor(Math.random() * 10000)}`;
      const lastName = `Test${Math.floor(Math.random() * 10000)}`;
      const password = `Pass!${Math.random().toString(36).slice(-8)}1A`;
      const organizationName = `Org${Math.floor(Math.random() * 1000)}`;
      
      cy.generateUniqueEmail().then((email) => {
          cy.wrap(email).as("email");
          cy.log("Generated Email: ", email);
      }); 

      // Fill out the registration form
      cy.get('#firstName').type(firstName).should('have.value', firstName);
      cy.get('#lastName').type(lastName).should('have.value', lastName);
      cy.get('#organizationType').select('HOSPITAL');
      cy.get('#organizationName').type(organizationName).should('have.value', organizationName);
      cy.get("@email").then((email) => {
          cy.get("#name").type(email).should("have.value", email);
      });
      cy.get('#password').type(password).should('have.value', password);
      cy.get('#confirmPassword').type(password).should('have.value', password);

      // Submit registration form
      cy.get('.cds--btn.cds--layout--size-lg.cds--btn--primary')
          .should('not.be.disabled')
          .click();

      // Allow some time for the form submission to complete and email to be sent
      cy.wait(10000); 
      
      // Visit OTP verification page
      cy.visit('https://auth.lafialink-dev.com/verify');

      cy.get("@email").then((email) => {
        cy.log("Fetching OTP for email: ", email);
        
        // Function to retry OTP fetching with exponential backoff
        const fetchOTPWithRetry = (retryCount = 4, initialDelay = 5000) => {
          const delay = initialDelay * Math.pow(1.5, retryCount - 4); // Increase delay with each retry
          
          cy.task("getOTPFromGmail", { email }).then((otp) => {
            if (otp) {
              // Success - use the OTP
              cy.log(` Successfully retrieved OTP: ${otp}`);
              cy.get("#otp").clear().type(otp);
              
              cy.get(".cds--btn.cds--layout--size-lg.cds--btn--primary").click();
              cy.contains("Invalid OTP", { timeout: 3000 })
  .should("be.visible")
  .then(($element) => {
    // Optionally log that we've successfully seen the message
    cy.log(" Successfully detected the 'Invalid OTP' message");
  }); // Adjust text to match your actual error message

// If you want to verify it disappears after a short time
//.get('.error-message, .notification, .toast, .alert') // Same selector as above
 // .should('not.exist', { timeout: 5000 });
              //cy.contains("Account Verified", { timeout: 15000 }).should("be.visible");
            } else if (retryCount > 0) {
              // No OTP - retry after delay
              cy.log(`⏱️ No OTP found. Retrying in ${delay/1000} seconds... (${retryCount} attempts left)`);
              cy.wait(delay);
              fetchOTPWithRetry(retryCount - 1, initialDelay);
            } else {
              // Out of retries
              cy.log("❌ Failed to retrieve OTP after multiple attempts");
              throw new Error("Could not retrieve OTP from email after multiple attempts");
            }
          });
        };
        
        // Start the retry process with more retries and longer delays
        fetchOTPWithRetry();
      });

      // Assert successful registration
      //cy.url().should('include', '/dashboard', { timeout: 30000 }); 
  });
});
