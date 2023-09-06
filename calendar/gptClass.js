/*

Class for interfacing with function calls (JSON retrieval from LLMs).

Currently only aimed to support OpenAI API. Maybe add support for other LLMs in the future.

*/

const { Configuration, OpenAIApi } = require("openai");
const { isValid } = require("date-fns");
const fs = require('fs');


class RetrieveFromLLM {
    constructor(provider = "openai", model = "gpt-3.5-turbo-0613") {
        try {

            this.provider = provider;

            this.authConfig = JSON.parse(fs.readFileSync('./authentication.config.json', 'utf-8'));
            this.apikey = this.authConfig[`${this.provider}`].apiKey;
            this.organization = this.authConfig[`${this.provider}`].organization;

            this.model = model;

            this.systemInstructions = "";
            this.userInstructions = "";

            this.jsonFunctions = [
                {
                    "name": "getEventsAttributes",
                    "description": "For every event return an array itwm with the title, description, price, location, ISO 8601 initDate and ISO 8601 endDate. If there's no event, return an empty array.",
                    "parameters": {
                    "type": "object",
                    "properties": {
                        "listOfEvents": {
                        "type": "array",
                        "description": "Array of events. If there are no events in the input text, just use an empty array",
                        "items": {
                            "type": "object",
                            "properties": {
                            "title": {
                                "type": "string",
                                "description": "The event title, e.g. Viñetas desde o Atlántico 2023"
                            },
                            "description": {
                                "type": "string",
                                "description": "The event description (leave empty in case of not being able to provide it or being too short), e.g. Edición do Viñetas desde o Atlántico do ano 2023 con estas novedades"
                            },
                            "price": {
                                "type": "string",
                                "description": "The event price, e.g. 100.00, Free or unavailable in case of not finding a price"
                            },
                            "location": {
                                "type": "string",
                                "description": "The event location, e.g. Calle Sinforiano Lopez 8, Unavailable in case of not finding a place"
                            },
                            "initDate": {
                                "type": "string",
                                "description": "The event starting date in ISO 8601 format, e.g. 2023-01-01T00:00:00"
                            },
                            "endDate": {
                                "type": "string",
                                "description": "The event ending date in ISO 8601 format, e.g. 2023-01-01T00:00:00. If no ending date is found, return starting date in ISO 8601 format."
                            }
                            },
                            "required": ["title", "price", "initDate"]
                        }
                        }
                    }
                    }
                }
                ];


            this.configuration = null;
            this.openai = null;

            if (this.provider == "openai") {

                this.configuration = new Configuration({
                    apiKey: this.apikey,
                    organization: this.organization
                })
                
                this.openai = new OpenAIApi(this.configuration);

                this.systemInstructions = `
                    You're an assistant tasked to return a list of events and its relevant info, from an input coming in either spanish or galician.

                    Only use ISO 8601 dates where specified.

                    Some ISO 8601 examples: 29 de Xullo would be 2023-07-29T00:00:00; 14 de Febrero a las 9 de la mañana would be 2023-02-14T09:00:00; 27 de setembro as oito da tarde would be 2023-09-27T20:00:00.

                    Not finding a starting date is an indication that there's no event, so you shouldn't return it.

                    If there's starting date but no ending date, just use the starting date for both.
                    `;
            }
        } catch (error) {
            throw new Error(`\n\nFailed to set up LLM:\n${error}`);
        }
    }

    setSystemInstructions(input) {
        this.systemInstructions = input;
    }

    setUserInstructions(input) {
        this.userInstructions = input;
    }

    addJsonFunction(func) {
        this.jsonFunctions.push(func);
    }

    async getEventsList(userInstructions = this.userInstructions, temperature = 0.8, tryAgains = 1) {
        
        if (userInstructions.length < 100) {
            console.error("\n\nWarning: User instructions are too short, under 100 chars!.\n");
        }

        // Sending the user instructions to the LLM        
        const completion = await this.openai.createChatCompletion({
            model: this.model,
            temperature: temperature,
            messages: [
                {"role": "system", "content": this.systemInstructions},
                {"role": "user", "content": userInstructions}
            ],
            functions: this.jsonFunctions,
            function_call: {"name": "getEventsAttributes"}
        });

        // Retrieving the list of events from the LLM
        const listOfEvents = JSON.parse(completion.data.choices[0].message.function_call.arguments).listOfEvents;

        // Checking how many initDates are valid and binning events
        let validEvents = [];
        let invalidEvents = [];

        if (listOfEvents.length > 0) {
            for (const event of listOfEvents) {
                let isValidISODate = isValid(new Date(event.initDate));
                event.validEvent = isValidISODate;
                event.validEvent ? validEvents.push(event) : invalidEvents.push(event);
            }
        }
        // =============================================================
        // iterate over invalid events
        // =============================================================
        let counter = 0;

        // Execute only if there's invalid events
        if (invalidEvents.length > 0) {
            const invalidEventsString = JSON.stringify(invalidEvents);
            const invalidEventsUserPrompt = `
            You previously provided invalid initDates with the following events, try again. \n\n

            This is the original input:\n\n

            ${userInstructions}

            This is the JS array with the events where you have to correct the initDates and provide a valid ISO 8601 date. Return only this ones, but corrected:

            ${invalidEventsString}`;

            // Iterate only N times, otherwise it would be too costly
            // Normally it wouldn't make sense to try more than once
            while (counter < tryAgains) {
                counter++;
                const completionOfInvalids = await this.openai.createChatCompletion({
                    model: this.model,
                    temperature: temperature,
                    messages: [
                        {"role": "system", "content": this.systemInstructions},
                        {"role": "user", "content": invalidEventsUserPrompt}
                    ],
                    functions: this.jsonFunctions,
                    function_call: {"name": "getEventsAttributes"}
                });
                
                let correctedListOfEvents = JSON.parse(completionOfInvalids.data.choices[0].message.function_call.arguments).listOfEvents;


                // If an event is valid, push to valid and remove from invalid arrays
                for (let index = 0; index < correctedListOfEvents.length; index++) {

                    let isValidISODate = isValid(new Date(correctedListOfEvents[index].initDate));
                    correctedListOfEvents[index].validEvent = isValidISODate;

                    if (correctedListOfEvents[index].validEvent) {
                        validEvents.push(correctedListOfEvents[index])
                        invalidEvents.splice(index, 1);
                    }
                    
                }
            }
        }

        // =============================================================
        // Check all endDates. If there's no valid endDate, use the initDate
        // =============================================================

        for (const event of validEvents) {
            let isValidISODate = isValid(new Date(event.endDate));
            !isValidISODate ? event.endDate = event.initDate : null;
        }

        return validEvents;
    }

    

}

module.exports = { RetrieveFromLLM };