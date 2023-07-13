/*

Orquestador de eventos para todas las fuentes de datos.

1. Obtener los eventos llamando a los diferentes scripts encargados de cada
fuente.
2. Almacena los eventos en una BD DuckDB.
3. Genera un archivo HTML con los eventos del día actual + próximos 10 días.
4. Sube el archivo por FTP al servidor de cometocoruna.com

---
URLs:

Ayto: https://www.coruna.gal/web/es/rss/ociocultura

---
Funciones:

Ayto: parseAytoFeed(url);

---

Esquema de la BD:

Tabla: feed

Nombre-de-columna (data type):
uuid (UUID)
title (VARCHAR)
link (VARCHAR)
price (VARCHAR)
initDate (VARCHAR)
endDate (TIMESTAMP)
content (TIMESTAMP)
image (VARCHAR)
source (VARCHAR)

Tanto el uuid como el source vienen ya generados por los diferentes scripts.

*/

// Requires parsing scripts
const parseAytoFeed = require('./dataSources/aytos/ayto-coruna-rss.js');
const parseAtaquillaDOM = require('./dataSources/ataquilla/ataquilla-scraper.js');
const parseMeetupDOM = require('./dataSources/meetup/meetup-scraper.js');
const parseEventBriteDOM = require('./dataSources/eventbrite/eventbrite-scraper.js');

// Local dependencies
const utils = require('./utils.js');
const db = require('./database.js');
const events = require('./events.js');

// Other dependencies
const fs = require('fs');
const handlebars = require('handlebars');
const ftpClient = require('ftp');


async function main() {
  // 1. Create db if it doesn't exist
  const dbPath = './feed.duckdb';
  const schema = 'main';
  const tableName = 'feed';
  let miBaseDuckDb = db.crearBaseDeDatos(dbPath, schema, tableName); // !! This fn defines the schema

    // 1.1 Read authentication configurations
    const authConfig = JSON.parse(fs.readFileSync('./authentication.config.json', 'utf-8'));

  // 2. Obtains events from each source
  // Each fn should return an array of objects fitting DB schema perfectly

    // 2.1 DEPRECATED We generate a unique UUID for the project, which will be requested by the
    // UUID library, and which we will pass as an argument to the different scripts.
    // Generated with https://www.uuidgenerator.net/version1

    // DEPRECATED const uniqueProjectUUIDNamespace = "1c9aafd0-0a15-11ee-be56-0242ac120002";

    // 2.2 Obtaining events from sources
      // 2.2.1 Ayto of A Coruna
      const aytoURL = "https://www.coruna.gal/web/es/rss/ociocultura";
      const aytoEventsPromise= parseAytoFeed(aytoURL);

      // 2.2.2 Ataquilla
      const ataquillaEntryPoint = 'https://entradas.ataquilla.com/ventaentradas/es/buscar?orderby=next_session&orderway=asc&search_query=Encuentra+tu+evento&search_city=A+Coru%C3%B1a&search_category=';
      const ataquillaMaxPages = 1; // Más de una página genera duplicados
      const ataquillaEventsPromise = parseAtaquillaDOM(ataquillaEntryPoint, ataquillaMaxPages);

      // 2.2.3 Meetup (See function documentation for details about active groups)
      const activeMeetupGroups = [
        "https://www.meetup.com/es-ES/a-coruna-expats/events/",
        "https://www.meetup.com/es-ES/english-conversation-language-transfer/events/",
        "https://www.meetup.com/es-ES/filomeetup-a-coruna/events/",
        "https://www.meetup.com/esl-378/events/",
        "https://www.meetup.com/python-a-coruna/events/",
        "https://www.meetup.com/loopyhoppers/events/",
        "https://www.meetup.com/gdg-coruna/events/",
        "https://www.meetup.com/gpul-labs/events/",
        "https://www.meetup.com/quedadas-coruna/events/",
        "https://www.meetup.com/a-coruna-cork-y-canvas-sessions/events/"

      ];
      const meetupMaxPages = 1; // No pagination implemented, not necessary for now
      const meetupEventsPromise = parseMeetupDOM(activeMeetupGroups, meetupMaxPages);

      // 2.2.4 Eventbirte
      const eventbriteURL = "https://www.eventbrite.es/d/united-states/all-events/?page=1&bbox=-8.735923924902409%2C43.182572282775%2C-8.213386693457096%2C43.64991191572349";
      const eventbriteMaxPages = 1; // No pagination implemented, not necessary for now
      const eventbriteEventsPromise = parseEventBriteDOM(eventbriteURL, eventbriteMaxPages, "iagovar@outlook.com", "Mandacarallo2");


    const [aytoEventsArray, ataquillaEventsArray, meetupEventsArray, eventbriteEventsArray] = await Promise.all([aytoEventsPromise, ataquillaEventsPromise, meetupEventsPromise, eventbriteEventsPromise]);

    // 2.3 Aggregate events from every source
    let arrayOfAllEvents = [];
    arrayOfAllEvents.push(
      ...aytoEventsArray,
      ...meetupEventsArray,
      ...ataquillaEventsArray,
      ...eventbriteEventsArray
      );

  // 3. Store events in DB
  await db.storeEventsInDB(miBaseDuckDb, schema, tableName, arrayOfAllEvents);

  // 4. Generating HTML file

    // 4.1 Retrieve events from DB from current day and next 10 days
    const numDays = 10;
    const initDate = utils.getCurrentDateTimestampFormat();
    const endDate = utils.getFutureDateTimestampFormat(numDays);

    const eventsToPrint = await db.getEntriesInRange(miBaseDuckDb, schema, tableName, initDate, endDate);

    // 4.2 Modify eventsToPrint to add new fields and structure
    const eventsToPush = await events.modifyEvents(eventsToPrint, numDays);

    // 4.2 Push objects to template
    const templateSourceName = "template.html";
    const templateOutputName = "calendar-output.html";
    const templateSourceString = './template/' + templateSourceName;
    const templateOutputString = './template/' + templateOutputName;

    await generateHTML(eventsToPush, templateSourceString, templateOutputString);

  // 5. Upload HTML file to FTP
  // FTP user gives direct access to the calendar directory
  // It also requires to specify the file name for the destination, not only the
  // the destination directory path.
  const localFolderPath = './template/';
  const remoteFolderPath = './';
  const localFilePath = localFolderPath + templateOutputName;
  const remoteFilePath = remoteFolderPath + templateOutputName;
  const ftpConfig = authConfig.ftp; // Obj containing sft config

  await  uploadFileByFTP(localFilePath, remoteFilePath, localFolderPath, remoteFolderPath, ftpConfig)

}


/**
 * Generates an HTML file using a Handlebars template and an array of objects.
 *
 * @param {Array} arrayOfObjects - An array of objects containing the data for the template.
 * @param {String} templateSourceString - The path to the Handlebars template file.
 * @param {String} templateOutputString - The path to the output HTML file.
 * @return {Promise} A promise that resolves when the HTML file is successfully generated, or rejects with an error.
 */
function generateHTML(arrayOfObjects, templateSourceString, templateOutputString) {
  return new Promise((resolve, reject) => {
    // Read the HTML template file
    const templateSourceObj = fs.readFileSync(templateSourceString, 'utf-8');

    // Compile the template with Handlebars
    const template = handlebars.compile(templateSourceObj);

    //Create a variable lastUpdated to the current date in dd/mm/yyyy hh:mm
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mn = String(now.getMonth() + 1).padStart(2, '0'); //January is 0!
    const yyyy = now.getFullYear();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const todayDate = dd + '/' + mn + '/' + yyyy + ' ' + hh + ':' + mm;

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



/**
 * Uploads a file to a remote server via FTP.
 *
 * @param {string} localFilePath - The local file path of the file to be uploaded.
 * @param {string} remoteFilePath - The remote file path where the file will be uploaded.
 * @param {string} localFolderPath - The local folder path containing the files to be uploaded.
 * @param {string} remoteFolderPath - The remote folder path where the files will be uploaded.
 * @param {object} ftpConfig - The FTP configuration object containing the necessary credentials and connection details.
 * @return {Promise} A promise that resolves when the file is uploaded successfully, or rejects with an error if there is any issue during the upload process.
 */
async function uploadFileByFTP(localFilePath, remoteFilePath, localFolderPath, remoteFolderPath, ftpConfig) {
  const client = new ftpClient();

  try {
    console.log('Connecting to FTP server...');
    // Connect to the FTP server
    await new Promise((resolve, reject) => {
      client.on('ready', resolve);
      client.on('error', reject);
      client.connect(ftpConfig);
    });
    console.log('Connected to FTP server.');

    console.log(`Uploading ${localFilePath} file to ${remoteFilePath} in remote server...`);
    // Upload the local template file to the remote server
    await new Promise((resolve, reject) => {
      client.put(localFilePath, remoteFilePath, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
    console.log('File uploaded successfully via FTP.');

    console.log(`Deleting contents of ${remoteFolderPath}img on remote server...`);
    // Delete the contents of the remote "img" directory
    try {
      await new Promise((resolve, reject) => {
        client.rmdir(`${remoteFolderPath}img`, true, (error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });
      console.log('Contents of remote "img" directory deleted successfully.');
    } catch (error) {
      // Handle the error when the directory doesn't exist
      if (error.code === 550) {
        console.log(`Directory "${remoteFolderPath}img" does not exist. Skipping removal.`);
      } else {
        throw error;
      }
    }

    // Creating the "img" directory in the remote server if it doesn't exist
    try {
      await new Promise((resolve, reject) => {
        client.mkdir(`${remoteFolderPath}img`, (error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      })
    } catch (error) {
      console.error('Error creating "img" directory:', error);
    }

    // Get the list of files in the local "img" directory
    const files = fs.readdirSync(localFolderPath + '/img');

    // Upload each file to the remote "img" directory
    for (const file of files) {
      await new Promise((resolve, reject) => {
        client.put(localFolderPath + '/img/' + file, remoteFolderPath + '/img/' + file, (error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      })
    }

    console.log('Files uploaded successfully via FTP.');

  } catch (error) {
    console.error('Error uploading file via FTP:', error);
    throw error;
  } finally {
    console.log('Closing FTP connection...');
    // Close the FTP connection
    client.end();
    console.log('FTP connection closed.');
  }
}



main();