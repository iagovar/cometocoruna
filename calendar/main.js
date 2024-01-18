/*

Event orchestrator for all events.

1. Fetch events by calling different scripts responsible for each source.
2. Store the events in a SQLite database.
3. Generate an HTML file with events for the current day + the next 10 days.
4. Upload the file via FTP to the cometocoruna.com server.

*/

// Debug Options.
const debugWithoutScraping = false;
const debugWithoutUploading = false;
const ForceInstagram = false;

// Requires parsing scripts
const parseAytoCorunaFeed = require('./dataSources/aytos/ayto-coruna-rss.js');
const parseAtaquillaDOM = require('./dataSources/ataquilla/ataquilla-scraper.js');
const parseMeetupDOM = require('./dataSources/meetup/meetup-scraper.js');
const parseEventBriteDOM = require('./dataSources/eventbrite/eventbrite-scraper.js');
const parseQuincemilDom = require('./dataSources/quincemil/quincemil-scraper.js');
const parsePencilAndFork = require('./dataSources/momAndPop/pencil-and-fork-scraper.js');
const { parseInstagramApify } = require('./dataSources/instagram/instagram-scraper.js');

// Other Local dependencies
const DatabaseConnection = require('./databaseClass.js');
const eventClustering = require('./eventClustering.js');
const uploadFileByFTP = require('./ftpOperations.js');
const generateHTML = require('./templateOperations.js');
const { EventItem } = require('./eventClass.js');
const LocalInference = require('./localInferenceClass.js');

// Other external dependencies
const fs = require('fs');
const path = require('path');
const dateFns = require('date-fns');
const { exec } = require('child_process');


async function main() {
  console.log("============ RUNNING SCRIPT ON " + new Date().toLocaleString() + " ============");

  // 1. Create db if it doesn't exist
  const dbPath = path.resolve(__dirname, './cometocoruna.sqlite3');
  const schemaConfig = require('./config/database_schema.json');
  let myDatabase = new DatabaseConnection(dbPath, schemaConfig); // Schema hardcoded in this class
  await new Promise(resolve => setTimeout(resolve, 2000));

  // 1.1 Read configurations
  const authConfig = require('./config/authentication.config.json');
  const scraperEntrypoints = require('./config/scraperEntrypoints.config.json');
  const meetupGroupsToScrapeList = fs.readFileSync(path.resolve(__dirname, './config/meetupGroups.config.txt'), 'utf-8').split('\n').filter(line => line.trim().length > 0);
  const instagramAccountsToScrapeList = fs.readFileSync(path.resolve(__dirname, './config/instagramAccounts.config.txt'), 'utf-8').split('\n').filter(line => line.trim().length > 0);

  // 2. Obtains events from each source
  // Each fn should return an array of objects fitting DB schema perfectly
  if (!debugWithoutScraping) {
    // 2.2 Obtaining events from sources
    // 2.2.1 Ayto of A Coruna
    const aytoCorunaEventsPromise= parseAytoCorunaFeed(scraperEntrypoints.aytoCoruna);

    // 2.2.2 Ataquilla
    const ataquillaMaxPages = 1; // Más de una página genera duplicados
    const ataquillaEventsPromise = parseAtaquillaDOM(scraperEntrypoints.ataquilla, ataquillaMaxPages);

    // 2.2.3 Meetup (See function documentation for details about active groups)
    const meetupMaxPages = 1; // No pagination implemented, not necessary for now
    const meetupEventsPromise = parseMeetupDOM(meetupGroupsToScrapeList, meetupMaxPages);

    // 2.2.4 Eventbrite
    const eventbriteMaxPages = 1; // No pagination implemented, not necessary for now
    const eventbriteEventsPromise = parseEventBriteDOM(scraperEntrypoints.eventbrite, eventbriteMaxPages, authConfig.eventbrite.user, authConfig.eventbrite.password);

    // 2.2.5 Quincemil
    const quincemilMaxPages = 1;
    const quincemilEventsPromise = parseQuincemilDom(scraperEntrypoints.quincemil, quincemilMaxPages);

    // MOM & POP SHOPS
    // 2.2.6 Pencil & Fork
    const pencilAndForkEventsPromise = parsePencilAndFork(scraperEntrypoints.pencilAndFork);

    // 2.2.7 Instagram accounts
    const instagramEventsPromise = parseInstagramApify(instagramAccountsToScrapeList, authConfig, ForceInstagram);
      

    // 2.3 Wait for all promises before putting it all in one array
    const [
      aytoCorunaEventsArray,
      ataquillaEventsArray,
      meetupEventsArray,
      eventbriteEventsArray,
      quincemilEventsArray,
      pencilAndForkArray,
      instagramEventsArray
    ] = await Promise.all([
      aytoCorunaEventsPromise,
      ataquillaEventsPromise,
      meetupEventsPromise,
      eventbriteEventsPromise,
      quincemilEventsPromise,
      pencilAndForkEventsPromise,
      instagramEventsPromise
    ]);

    // 2.4 Aggregate events from every source
    let arrayOfAllEvents = [];
    arrayOfAllEvents.push(
      ...aytoCorunaEventsArray,
      ...meetupEventsArray,
      ...ataquillaEventsArray,
      ...eventbriteEventsArray,
      ...quincemilEventsArray,
      ...pencilAndForkArray,
      ...instagramEventsArray
      );

    // 2.5 Label events with categories & locations with a combination of formal logic and zero-shot classifiers. This requires to have te Flask inference server up and running

    const localInferenceServer = new LocalInference("http://localhost:5000/inference");

    await localInferenceServer.startServer();
    await new Promise(resolve => setTimeout(resolve, 20000));
    await localInferenceServer.getCategories(arrayOfAllEvents);
    await localInferenceServer.getLocation(arrayOfAllEvents);
    await localInferenceServer.stopServer();

    // 3. Store events in DB
    await myDatabase.asyncStoreEventsInDB(arrayOfAllEvents);
    arrayOfAllEvents = undefined; // Forcing freeing memory, dude to some GC shanenigans, as we're very constrained in RAM.

  } // End of debug without scraping


  // 4. Generating HTML file

  // 4.1 Retrieve events from DB from past 10 days and next 10 days,
  // This is done because there may events that are still happening today but begun earlier, so we have to account for that.
  const numDays = 10;
  
  const initDateObj = dateFns.sub(dateFns.startOfDay(new Date()), { days: numDays })
  const endDateObj = dateFns.add(dateFns.startOfDay(new Date()), { days: numDays })
  const initDateISO = dateFns.formatISO(initDateObj)
  const endDateISO = dateFns.formatISO(endDateObj)

  const eventsToCluster = await myDatabase.getEntriesInRange(initDateISO, endDateISO);

  // 4.2 Filter events by banned words.
  const bannedStringsFilePath = path.resolve(__dirname, './config/banned-strings.txt');
  const filteredEvents = await EventItem.filterByBannedStrings(eventsToCluster, bannedStringsFilePath);

  // 4.3 Run all the events through a clustering algorithm.
  //
  // Check generateClusters() for details of the output structure.
  // 
  // Event clustering also downloads and modifies images for each event.
  // It's done like this because if handled by eventClass there would be too
  // many images to handle, instead of only the filtered ones.
  const imgLocalDestinationFolder = path.resolve(__dirname, './template/img/') + '/';
  const imgRemoteFolderURL = 'https://cometocoruna.com/assets/calendar/img/';
  const eventsToPrint = await eventClustering(filteredEvents, numDays, imgLocalDestinationFolder, imgRemoteFolderURL);

  // 4.4 Push objects to template
  const templateSourceName = "template.html";
  const templateOutputName = "calendar-output.html";
  const templateLocalFolderPath = path.resolve(__dirname, './template/') + '/';
  const templateSourceString = templateLocalFolderPath + '/' + templateSourceName;
  const templateOutputString = templateLocalFolderPath + '/' + templateOutputName;

  await generateHTML(eventsToPrint, templateSourceString, templateOutputString, debugWithoutUploading);

  // 5. Upload HTML file to FTP
  // FTP user gives direct access to the calendar directory
  // It also requires to specify the file name for the destination, not only the
  // the destination directory path.
  const localFolderPath = templateLocalFolderPath;
  const remoteFolderPath = './';
  const localFilePath = localFolderPath + templateOutputName;
  const remoteFilePath = remoteFolderPath + templateOutputName;
  const ftpConfig = authConfig.ftp; // Obj containing sft config

  if (!debugWithoutUploading) {
    await uploadFileByFTP(localFilePath, remoteFilePath, localFolderPath, remoteFolderPath, ftpConfig)
  }

  // closing database connection
  myDatabase.close();

  // HOTFIX Closing all chrome instances on system
  /* made because apparently browser.close() is not really closing chrome instances
     and seems to be causing lots of timeouts down the road for reasons I wasn't
     able to track within two hours.

     Don't have more time for this bug now.

     The script failed after a couple of days leaving most get requests on
     timeout, but worked after a reboot of the server.

     The glances tool shows chrome instances on the system when they should be
     closed, so I assume this is what is causing the problem.

     We'll see.
  */

  try {
    exec('pkill chrome', (error, stdout, stderr) => {
      // pkill chrome command executed successfully
      console.log(`pkill chrome command executed successfully, stdout: ${stdout}`);
    });
  } catch (error) {
    console.error(`Error executing pkill chrome: ${error.message}`);
  }


  console.log("Script finished")
}

main();
