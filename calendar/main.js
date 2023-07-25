/*

Event orchestrator for all events.

1. Fetch events by calling different scripts responsible for each source.
2. Store the events in a DuckDB database.
3. Generate an HTML file with events for the current day + the next 10 days.
4. Upload the file via FTP to the cometocoruna.com server.

*/

// Requires parsing scripts
const parseAytoCorunaFeed = require('./dataSources/aytos/ayto-coruna-rss.js');
const parseAtaquillaDOM = require('./dataSources/ataquilla/ataquilla-scraper.js');
const parseMeetupDOM = require('./dataSources/meetup/meetup-scraper.js');
const parseEventBriteDOM = require('./dataSources/eventbrite/eventbrite-scraper.js');
const parseQuincemilDom = require('./dataSources/quincemil/quincemil-scraper.js');

// Other Local dependencies
const db = require('./databaseOperations.js');
const eventClustering = require('./eventClustering.js');
const uploadFileByFTP = require('./ftpOperations.js');
const generateHTML = require('./templateOperations.js');

// Other external dependencies
const fs = require('fs');
const dateFns = require('date-fns');


async function main() {
  // 1. Create db if it doesn't exist
  const dbPath = './cometocoruna.sqlite3';
  const schema = 'main'; // Not necessary for SQLite, only DuckDB
  const tableName = 'events';
  let myDatabase = db.createDataBase(dbPath, schema, tableName); // !! This fn defines the schema

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
      const aytoEventsPromise= parseAytoCorunaFeed(aytoURL);

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
        "https://www.meetup.com/a-coruna-cork-y-canvas-sessions/events/",
        "https://www.meetup.com/wordpresscoruna/events/"

      ];
      const meetupMaxPages = 1; // No pagination implemented, not necessary for now
      const meetupEventsPromise = parseMeetupDOM(activeMeetupGroups, meetupMaxPages);

      // 2.2.4 Eventbirte
      const eventbriteURL = "https://www.eventbrite.es/d/united-states/all-events/?page=1&bbox=-8.735923924902409%2C43.182572282775%2C-8.213386693457096%2C43.64991191572349";
      const eventbriteMaxPages = 1; // No pagination implemented, not necessary for now
      const eventbriteEventsPromise = parseEventBriteDOM(eventbriteURL, eventbriteMaxPages, authConfig.eventbrite.user, authConfig.eventbrite.password);

      // 2.2.5 Quincemil
      const quincemilEntryPoint = 'https://www.elespanol.com/quincemil/servicios/agenda/zona/a-coruna';
      const quincemilMaxPages = 1;
      const quincemilEventsPromise = parseQuincemilDom(quincemilEntryPoint, quincemilMaxPages);


    const [
      aytoEventsArray,
      ataquillaEventsArray,
      meetupEventsArray,
      eventbriteEventsArray,
      quincemilEventsArray
    ] = await Promise.all([
      aytoEventsPromise,
      ataquillaEventsPromise,
      meetupEventsPromise,
      eventbriteEventsPromise,
      quincemilEventsPromise
    ]);

    // 2.3 Aggregate events from every source
    let arrayOfAllEvents = [];
    arrayOfAllEvents.push(
      ...aytoEventsArray,
      ...meetupEventsArray,
      ...ataquillaEventsArray,
      ...eventbriteEventsArray,
      ...quincemilEventsArray
      );

  // 3. Store events in DB
  await db.storeEventsInDB(myDatabase, schema, tableName, arrayOfAllEvents);

  // 4. Generating HTML file

    // 4.1 Retrieve events from DB from past 10 days and next 10 days
    const numDays = 10;
    const initDateObj = dateFns.sub(dateFns.startOfDay(new Date()), { days: numDays })
    const endDateObj = dateFns.add(dateFns.startOfDay(new Date()), { days: numDays })
    const initDateISO = dateFns.formatISO(initDateObj)
    const endDateISO = dateFns.formatISO(endDateObj)

    const eventsToPrint = await db.getEntriesInRange(myDatabase, schema, tableName, initDateISO, endDateISO);

    // 4.2 Modify eventsToPrint to add new fields and structure
    // Event clustering also downloads and modifies images for each event.
    // It's done like this because if handled by eventClass there would be too
    // many images to handle, instead of only the filtered ones.
    const imgLocalDestinationFolder = './template/img/';
    const imgRemoteFolderURL = 'https://cometocoruna.com/assets/calendar/img/';
    const eventsToPush = await eventClustering(eventsToPrint, numDays, imgLocalDestinationFolder, imgRemoteFolderURL);

    // 4.2 Push objects to template
    const templateSourceName = "template.html";
    const templateOutputName = "calendar-output.html";
    const templateLocalFolderPath = './template/';
    const templateSourceString = templateLocalFolderPath + templateSourceName;
    const templateOutputString = templateLocalFolderPath + templateOutputName;

    await generateHTML(eventsToPush, templateSourceString, templateOutputString);

  // 5. Upload HTML file to FTP
  // FTP user gives direct access to the calendar directory
  // It also requires to specify the file name for the destination, not only the
  // the destination directory path.
  const localFolderPath = templateLocalFolderPath;
  const remoteFolderPath = './';
  const localFilePath = localFolderPath + templateOutputName;
  const remoteFilePath = remoteFolderPath + templateOutputName;
  const ftpConfig = authConfig.ftp; // Obj containing sft config

  await  uploadFileByFTP(localFilePath, remoteFilePath, localFolderPath, remoteFolderPath, ftpConfig)

  // closing database connection
  myDatabase.close();
}

main();