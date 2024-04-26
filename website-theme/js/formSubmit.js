const newsletterForm = document.getElementById('newsletterForm');
const confirmationMessage = document.getElementById('confirmationMessage');
const portalId = '45929286';
const formGUID = '3d9743a5-0547-4fdf-9cca-18c820168380';

//preventDefault so we can send form data to our serverless funciton (handle-submit.js)
//Then send the data in parallel to HubSpot's clone of the form. 
//This is usefulf or data tracking, reporting, and workflow automations inside HubSpot.
newsletterForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    newsletterForm.style.display = 'none';
    confirmationMessage.style.display = 'block';

    const submissionBody = {};
    const formData = new FormData(newsletterForm);

    // Function to extract hs-content-id from a class name
    // This is used to cause HubSpot to attribute the submission to a specific HubSpot page
    function getHsContentId() {
        // Find the div with the class that includes 'hs-content-id-'
        const div = document.querySelector('div[class*="hs-content-id-"]');
    
        if (div) {
            // Extract the class list
            const classList = div.className.split(/\s+/);
        
            // Find the class that contains 'hs-content-id-'
            const contentIdClass = classList.find(className => className.startsWith('hs-content-id-'));
        
            if (contentIdClass) {
                // Extract the ID from the class name
                const contentId = contentIdClass.split('-').pop();
                return contentId;
            }
        }
        return null; // Return null if no matching class or div is found
    }
  
    
    const hsContentId = getHsContentId();
    console.log('the page id for attribution is: ', hsContentId);
  

    //format form data for api use
    for (const [key, value] of formData.entries()) {
        submissionBody[key] = value;
    }
    console.log('Submission data:', submissionBody);

    try {
        console.log('Stringified Submission Data:', JSON.stringify(submissionBody));

        const response = await fetch(newsletterForm.action, {
            method: newsletterForm.method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(submissionBody)
        });

        console.log('Form submitted', response);

        //Form Data to send in parallel to HubSpot's version of the form
        //https://legacydocs.hubspot.com/docs/methods/forms/submit_form
        const HSFormData = {
            "fields": [
              {
                "objectTypeId": "0-1",
                "name": "email",
                "value": submissionBody.email,
              },
              {
              "objectTypeId": "0-1",
                "name": "firstname",
                "value": submissionBody.firstName,
              },
              {
              "objectTypeId": "0-1",
                "name": "lastname",
                "value": submissionBody.lastName,
              }
            ],
            "pageId": hsContentId,
            "legalConsentOptions": {
              "consent": { // Include this object when GDPR options are enabled
                "consentToProcess": true,
                "text": "I agree to allow Example Company to store and process my personal data.",
                "communications": [
                  {
                    "value": true,
                    "subscriptionTypeId": 999,
                    "text": "I agree to receive marketing communications from Example Company."
                  }
                ]
              }
            }
          }

        //define function and submit to the HubSpot form
        const submitHSForm = async () => {
            try {
              const response = await fetch(`https://api.hsforms.com/submissions/v3/integration/submit/${portalId}/${formGUID}`, {
                method: 'POST',
                headers: {
                'Content-Type': 'application/json',
                },
                body: JSON.stringify(HSFormData)
              }); 
              const data = await response.json();
              console.log(data);
            } catch (error) {
              console.log('Error:', error);      
            } 
        }

        submitHSForm();
    } catch (error) {
        console.error('Error submitting form:', error);
   }
 });