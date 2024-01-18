const axios = require('axios');
const { spawn, exec } = require('child_process');

class LocalInference {
    constructor(inferenceUrl) {
        this.inferenceUrl = inferenceUrl;

        this.categoriesList = Object.keys(require('./config/categories.config.json'));

        this.terminal = null;

        // Spinning up a terminal to manage the inference server

    }

    async startServer() {
        this.terminal = spawn('/bin/bash');
        this.terminal.stdin.write(`echo "Bash instance started"\n`);
        this.terminal.stdout.on('data', (data) => {
          console.log(`${data}`);
        });
        this.terminal.stderr.on('data', (data) => {
          console.error(`${data}`);
        });
        this.terminal.stdin.write(`echo "Trying to start inference server"\n`);
        this.terminal.stdin.write(`cd ${__dirname}\n`);
        this.terminal.stdin.write(`cd ../inference\n`);
        this.terminal.stdin.write('source ./inference-virtualenv/bin/activate\n');
        this.terminal.stdin.write(`flask --app inference run --host=0.0.0.0\n`);
        // wait for the server to start
        await new Promise(resolve => setTimeout(resolve, 10000));
    }

    async stopServer() {
        exec('pkill flask', (error, stdout, stderr) => {
            if (error) {
                console.log(`error: ${error.message}`);
                return;
            }
            if (stderr) {
                console.log(`stderr: ${stderr}`);
                return;
            }
            console.log(`stdout: ${stdout}`);
        })
        this.terminal.stdin.write('exit\n');
        this.terminal.kill();
        await new Promise(resolve => setTimeout(resolve, 1000));
    }


    /**
     * Retrieves the location of the events in the given array using the inference service.
     *
     * @param {Array} arrayOfEvents - The array of events to retrieve the location for.
     * @param {string} inferenceUrl - The URL of the inference service. Defaults to the class's inferenceUrl.
     * @return {Promise<Array>} - A promise that resolves to the updated array of events with the location information.
     */
    async getLocation(arrayOfEvents, inferenceUrl = this.inferenceUrl) {

        const locationQuestion = `¿Dónde se localiza el evento?`;
    
        for (const event of arrayOfEvents) {
            /* Avoid calling the inference service if:
              - event.location lenght is >= 4 (4 is the length of null)
              - event.link contains "instagram", as those are handled by way more powerful LLMs
            */
    
            if (String(event.location).length >= 4) {continue}
            if (String(event.link).includes("instagram")) {continue}
    
            const context = String(event.textContent)
              .replaceAll("\n", " ")
              .replaceAll("\t", " ")
              .trim();

            const response = await axios({
                url: `${inferenceUrl}/qa`,
                method: 'POST',
                data: {
                    "context": context,
                    "question": locationQuestion
                }
            });

            if (response.status === 200) {
              // Select location if it's over 4 chars lenght (null is 4 chars)
              if (response.data.result.answer.length >= 4) {
                event.location = response.data.result.answer;
              } else {
                event.location = ""
              }
            } else {
              console.error(`Error ${response.status}: ${response.statusText}`);
            }
        }
    
        return arrayOfEvents;
    
    }


    /**
     * Retrieves the categories for an array of events.
     *
     * @param {Array} arrayOfEvents - An array of events to categorize.
     * @param {string} [inferenceUrl=this.inferenceUrl] - The URL of the inference service.
     * @param {Array} [categoriesList=this.categoriesList] - The list of categories to use for categorization.
     * @return {Array} - The array of events with the categories added.
     */
    async getCategories(arrayOfEvents, inferenceUrl = this.inferenceUrl, categoriesList = this.categoriesList) {

        for (const event of arrayOfEvents) {
            /* Avoid calling the inference service if:
              - event.link contains "instagram", as those are handled by way more powerful LLMs
            */
    
            if (String(event.link).includes("instagram")) {continue}
            
            const context = String(event.textContent)
              .replaceAll("\n", " ")
              .replaceAll("\t", " ")
              .trim();

            const response = await axios({
                url: `${inferenceUrl}/categorize`,
                method: 'POST',
                data: {
                    "context": context,
                    "categoriesList": categoriesList
                }
            })
    
            if (response.status === 200) {
              // Select categories over 0.2 score
              const repliedCategories = response.data.result.labels;
              const repliedScores = response.data.result.scores;
              const filteredCategories = [];
              
              for (let i = 0; i < repliedCategories.length; i++) {
                if (repliedScores[i] > 0.2) {
                  filteredCategories.push(repliedCategories[i]);
                }
              }
    
              event.categories = filteredCategories;
            } else {
              console.error(`Error ${response.status}: ${response.statusText}`);
            }
            
            
        }
    
        return arrayOfEvents;
    }


}

/*
async function main() {
    const miservidor = new LocalInference("http://localhost:5000/inference");
    await miservidor.startServer();

    let context = "Me llamo pepita";
    let locationQuestion = `¿Cómo me llamo?`;

    let events = [
        {
            "id": "1",
            "link": "Event 1",
            "textContent": "El concierto se celebra en Madrid",
            "location": "",
        }
    ]

    let response = await miservidor.getLocation(events);

    console.log(`El array queda: ${JSON.stringify(events)}`);
    await miservidor.stopServer();
    console.log("Servidor apagado");
}


main();
*/


module.exports = LocalInference;