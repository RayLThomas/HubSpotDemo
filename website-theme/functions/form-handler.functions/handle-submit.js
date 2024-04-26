var http = require("https");

exports.main = async (context, sendResponse) => {
    try {
        // Use the True-Client-IP header if available
        let clientIp = context.headers['true-client-ip'];

        // If True-Client-IP isn't available, fall back to the first IP in X-Forwarded-For
        if (!clientIp && context.headers['x-forwarded-for']) {
            clientIp = context.headers['x-forwarded-for'].split(',')[0].trim();
        }

        console.log('The client\'s IP address is: ', clientIp);

        const formData = context.body;
        // IP Geolocation service setup
        const apiKey = process.env.ipGeoLocationAPIKey;
        const ipGeoUrl = `https://api.ipgeolocation.io/ipgeo?apiKey=${apiKey}&ip=${clientIp}`;

        // Fetch IPGeolocation data
        const ipGeoResponse = await fetch(ipGeoUrl);
        const ipGeoData = await ipGeoResponse.json();

        // Use the state from the IPGeolocation data
        const state = ipGeoData.state_prov;
        const city = ipGeoData.city;

        // Extract latitude and longitude from IPGeolocation data
        const { latitude, longitude } = ipGeoData;

        // Make a request to Nominatim for reverse geocoding
        const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`;
        const nominatimResponse = await fetch(nominatimUrl);
        const nominatimData = await nominatimResponse.json();
        const county = nominatimData.address.county;
        
        const properties = {
            "firstname": formData.firstName,
            "lastname": formData.lastName,
            "email": formData.email,
            "state": state,
            "city": city,
            "county": county,
        };

        var options = {
            "method": "POST",
            "hostname": "api.hubapi.com",
            "port": null,
            "path": "/crm/v3/objects/contacts",
            "headers": {
                "accept": "application/json",
                "content-type": "application/json",
                "authorization": `Bearer ${process.env.HubSpotIntegrationKey}`
            }
        };
        
        var req = http.request(options, function (res) {
            var chunks = [];
            res.on("data", function (chunk) { chunks.push(chunk); });
            res.on("end", function () {
                var body = Buffer.concat(chunks);
                console.log("API Response:", body.toString());
                
                if (res.statusCode === 200 || res.statusCode === 201) {
                    const responseData = JSON.parse(body.toString());
                    sendResponse({ body: `HubSpot contact created/updated: ${JSON.stringify(responseData)}`, statusCode: 200 });
                } else if (res.statusCode === 409) {
                    console.log("Contact already exists.");
                    const { message } = JSON.parse(body);
                    console.log(message); 
                    //The error message that exposes the vid will look like: Contact already exists. Existing ID: 14346843154
                    const parseErrorForContactID = (str) => {
                        const match = str.match(/Existing ID: (\d+)/);
                        return match ? match[1] : null;
                    };

                    const contactID = parseErrorForContactID(message);

                    if (contactID) {
                        options = {
                            "method": "PATCH",
                            "hostname": "api.hubapi.com",
                            "port": null,
                            "path": `/crm/v3/objects/contacts/${contactID}`,
                            "headers": {
                              "accept": "application/json",
                              "content-type": "application/json",
                              "authorization": `Bearer ${process.env.HubSpotIntegrationKey}`
                            }
                          };
                    
                    
                          const updateReq = http.request(options, (updateRes) => {
                            let updateChunks = [];
                            updateRes.on('data', (chunk) => { updateChunks.push(chunk); });
                            updateRes.on('end', () => {
                                const updateBody = Buffer.concat(updateChunks).toString();
                                console.log('Update API Response:', updateBody);

                                if (updateRes.statusCode >= 200 && updateRes.statusCode < 300) {
                                    sendResponse({ body: `Contact updated successfully: ${updateBody}`, statusCode: 200 });
                                } else {
                                    sendResponse({ body: `Failed to update contact. Status: ${updateRes.statusCode}, Body: ${updateBody}`, statusCode: updateRes.statusCode });
                                }
                            });
                        });

                        updateReq.on('error', (error) => {
                            console.error('Update Request Error:', error);
                            sendResponse({ body: JSON.stringify({ message: 'An error occurred during the update request.', error: error.toString() }), statusCode: 500 });
                        });

                        // Write the properties to the request body for updating
                        console.log('properties just before update: ', properties);
                        updateReq.write(JSON.stringify({properties}));
                        updateReq.end();
                    } else {
                        console.error("Failed to extract contact ID from the error message.");
                        sendResponse({ body: `Failed to extract contact ID for update.`, statusCode: 500 });
                    }
                } else {
                    console.error("API Error Response");
            }
            });
        });

        req.write(JSON.stringify({properties}));
        req.end();

    } catch (error) {
        console.error('Error:', error);
        sendResponse({ body: JSON.stringify({ message: 'An error occurred.', error: error.message }), statusCode: 500 });
    }
};
