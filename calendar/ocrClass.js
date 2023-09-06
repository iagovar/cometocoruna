const { ComputerVisionClient } = require("@azure/cognitiveservices-computervision");
const { CognitiveServicesCredentials } = require("@azure/ms-rest-azure-js");
const fs = require('fs');
const dateFns = require('date-fns');

const AbstractDomScraper = require("./scraperClass.js");

/**
* Class representing an OCR service.
* @class
*/
class ReadTextFromImage {
    /**
     * Constructor of the ReadTextFromImage class
     *
     * @param {string} [provider="azure"] - Select between azure (default) or google (not implemented yet).
     */
    constructor(provider = "azure") {
        this.provider = provider;
        
        try {
            this.authConfig = JSON.parse(fs.readFileSync('./authentication.config.json', 'utf-8'));
            this.key = this.authConfig[`${this.provider}`].key;
            this.endpoint = this.authConfig[`${this.provider}`].endpoint;
        } catch (error) {
            throw new Error(`\n\nFailed to read authentication config file:\n${error}`);
        }

        try {
            if (this.provider == "azure") {
                this.cognitiveServiceCredentials = new CognitiveServicesCredentials(this.key);
                this.azureClient = new ComputerVisionClient(this.cognitiveServiceCredentials, this.endpoint);
            }
        } catch (error) {
            throw new Error(`\n\nFailed to create ${this.provider} OCR instance:\n${error}`);
        }

        // This two attributes may account for pricing tier limits in the future
        this.lastrun = null;
        this.runcount = 0;

        
    }

    /**
     * Retrieves text from a given URL using the Azure OCR service.
     *
     * @param {string} url - The URL from which to retrieve text.
     * @param {string} [model="latest-preview"] - The model version to use for the OCR service.
     * @return {Promise<string>} - The retrieved text from the URL.
     */
    async getTextFromURL(url, model = "latest-preview") {
        try {
            const options = {
                modelVersion: model
              };
    
            const proposal = await this.azureClient.read(url, options);
    
            await AbstractDomScraper.AbstractDomScraper.waitSomeSeconds(2, 2);
    
            const response = await this.azureClient.getReadResult(proposal["apim-request-id"]);
    
            let finalText = "";
            for (const iterator of response.analyzeResult.readResults[0].lines) {
                finalText += iterator.text + "\n";
            }

            return finalText;
        } catch (error) {
            console.error(`\n\nOCR failed, returning empty string:\n${error}`);
            return "";
        }
    }


}

module.exports = { ReadTextFromImage };