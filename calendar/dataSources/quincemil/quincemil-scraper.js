const puppeteer = require('puppeteer');
const { convert } = require('html-to-text');
const { EventItem } = require('../../eventClass.js');
const DatabaseConnection = require('../../databaseClass.js');
const dateFns = require('date-fns');



async function parseQuincemilDom(entryPoint, maxPages) {
    // Opening puppeteer and applying configurations
    const browser = await puppeteer.launch({
        headless: true
    })

    const wrapperPage = await browser.newPage();

    // Additional browser configuration
    await wrapperPage.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.150 Safari/537.36'
      );
      await wrapperPage.setJavaScriptEnabled(true);
      await wrapperPage.setViewport({
        width: 1024,
        height: 768,
        deviceScaleFactor: 1
      })
    
    // Go to the entry point URL
    const pageUrl = `${entryPoint}`;
    await wrapperPage.goto(pageUrl);

    // make the script wait for a random number of seconds between 3 and 5
    await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * (5000 - 3000 + 1)) + 3000));


    // Selecting all wrapper elements
    let listOfEvents = [];
    let wrapperOfEvents = null;
    try {
        wrapperOfEvents = await wrapperPage.$$('.util_cartelera_estreno');
    } catch (error) {
        console.error(`\n\nCouldn't locate wrapper of events in ${entryPoint}\nClosing browser and returining an empty array`);
        await browser.close();
        return [];
    }

    /*
    * Going after single events
    * 
    * All events should have title, link, initDate
    */
    for (const singleEvent of wrapperOfEvents) {
        // Declaring Item and EventPage before try/catch so it's available in both
        // blocks
        let item = {source: "quincemil"};
        let eventPage;
        
        // Extracting title and link from a wrapper card
        try {
            item.title = await singleEvent.$eval('.util_cartelera_estreno_titulo .linktotal', (a) => a.innerText.trim());
            item.link = await singleEvent.$eval('.util_cartelera_estreno_titulo .linktotal', (a) => a.href);            
        } catch (error) {
            console.error(`\n\nCouldn't retrieve title and link from a ${item.source} wrapper \nJumping to next event`);
            continue;
        }

        // If the item has been in the database for less than 5 days, skip it
        const myDatabase = new DatabaseConnection();
        const dateInDB = await myDatabase.checkLinkInDB(item.link);
        const today = new Date();
        if (dateInDB != null) {
            const howManyDays = dateFns.differenceInDays(today, dateInDB);
            if (howManyDays < 5) {
            console.log(`\nItem link already in DB for less than 5 days, skipping:\n${item.link}`);
            continue;
            }
        }

        // Navigating to item.link, where we'll get the rest of the event info
        try {
            eventPage = await browser.newPage();
            await eventPage.goto(item.link);
            await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * (10000 - 12000 + 1)) + 10000));
        } catch (error) {
            console.error(`\n\nError opening a tab in ${item.source}, skipping event ${item.link} \n${error}`);
            continue;
        }

        // Extracting Script with event info from HEAD (there are two, $eval selects the first one)
        let scriptContent = null;
        let eventData = null;
        try {
            scriptContent = await eventPage.$eval('script[type="application/ld+json"]', (script) => script.textContent);
            eventData = JSON.parse(scriptContent);
        } catch (error) {
            console.error(`\n\nSkipping and closing tab: Failed locating data script in ${item.link}\n${error}`);
            await eventPage.close();
            continue;
        }

        // Going after initDate
        try {
            item.initDate = eventData.startDate;
        } catch (error) {
            console.error(`\n\nSkipping and closing tab: Failed locating start date in ${item.link}\n${error}`);
            await eventPage.close();
            continue;
        }

        // Going after endDate
        try {
            item.endDate = eventData.endDate;
        } catch (error) {
            console.error(`\n\nFailed locating end date in ${item.link}, setting initDate as endDate:\n${error}`);
            item.initDate = item.endDate;
            item.endDate = item.initDate;
        }

        // Extracting image url from evenData script
        try {
            // TODO: La evaluación por selector retorna
            // "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEHAAEALAAAAAABAAEAAAICTAEAOw=="
            // por alguna razón que desconozco, cuando el selector está bien en dev tools
            // item.image = await eventPage.$eval('.articulo_foto img', (img) => img.src);
            item.image = eventData.image[0];
        } catch (error) {
            console.error(`\n\nFailed to obtain image in ${item.link}, setting a default one:\n${error}`);
            item.image = "https://i.imgur.com/DLAyDDi.png"; // Logo quincemil
        }

        // Going after the content
        try {
            // Convert() strips of html tags
            item.content = convert(eventData.description);
        } catch (error) {
            console.error(`\n\nFailed to obtain description in ${item.link}, setting description to '':\n${error}`);
            item.content = "";
        }

        // Going after the price
        try {
            item.price = eventData.offers.price;
        } catch (error) {
            console.error(`\n\nFailed to obtain price in ${item.link}, setting it to 'Free or unavailable':\n${error}`);
            item.price = "Free or unavailable";
        }

        // Closing tab
        console.log(`Closing page: Scraping finished for ${item.link}`);
        await eventPage.close();

        // if nothing failed create an event instance and push it to the list of events
        // The EventItem constructor should handle all sanity checks and conversions
        const tempItem = new EventItem(
            item.title,
            item.link,
            item.price,
            item.content,
            item.image,
            item.source,
            item.initDate,
            item.endDate
        );

        listOfEvents.push(tempItem);

    }

    // For loope ended, close the browser
    console.log("Closing browser in Quincemil");
    await browser.close();
    return listOfEvents;
}

/**
const entryPoint = 'https://www.elespanol.com/quincemil/servicios/agenda/zona/a-coruna';
const maxPages = 1;


const scrapedItems = parseQuincemilDom(entryPoint, maxPages);
**/

module.exports = parseQuincemilDom;