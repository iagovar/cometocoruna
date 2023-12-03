const fs = require('fs');
const handlebars = require('handlebars');
const { format } = require('date-fns');

/**
 * Generates an HTML file based on an array of objects and a template.
 *
 * @param {Array} arrayOfObjects - The array of objects containing the data for the HTML generation.
 * @param {string} templateSourceString - The path to the HTML template file.
 * @param {string} templateOutputString - The path to save the generated HTML file.
 * @param {boolean} debugWithoutUploading - If true, the generated HTML file will use local image paths.
 * @return {Promise} A promise that resolves when the HTML file is generated successfully, or rejects with an error.
 */
function generateHTML(arrayOfObjects, templateSourceString, templateOutputString, debugWithoutUploading) {
    return new Promise((resolve, reject) => {

      // If debugWithoutUploading is true, use local image paths
      let modifiedEvent;
      if (debugWithoutUploading) {
        try {
          for (const day of arrayOfObjects) {
            for (const event of day.dayEvents) {
              modifiedEvent = event;
              event.image = '.' + event.localImageLocation;
            }
          }
        } catch (error) {
          console.error(`Error setting local img path: ${error}\n\n${JSON.stringify(modifiedEvent)}`);
        }
      }

      // Read the HTML template file
      const templateSourceObj = fs.readFileSync(templateSourceString, 'utf-8');
  
      // Compile the template with Handlebars
      const template = handlebars.compile(templateSourceObj);
  
      //Create a variable lastUpdated to the current date in dd/mm/yyyy hh:mm
      const now = new Date();
      const todayDate = format(now, 'dd/MM/yyyy HH:mm');
  
      // Generate the HTML using the data from the array of objects and todayDate
      const html = template({ entries: arrayOfObjects, lastUpdated: todayDate });
  
      // Save the generated HTML to a file
      fs.writeFile(templateOutputString, html, (error) => {
        if (error) {
          reject(error);
        } else {
          console.log(`HTML file generated at: ${templateOutputString}`);
          resolve();
        }
      });
    });
}

module.exports = generateHTML;