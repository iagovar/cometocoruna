const puppeteer = require('puppeteer');
const { convert } = require('html-to-text');
const { EventItem } = require('../../eventClass.js');
const DatabaseConnection = require('../../databaseClass.js');
const dateFns = require('date-fns');


/**
 * Parses the EventBrite DOM to extract event information.
 *
 * @param {string} entryPoint - The URL of the entry point.
 * @param {number} maxPages - The maximum number of pages to parse.
 * @param {string} user - The username for EventBrite account.
 * @param {string} password - The password for EventBrite account.
 * @return {Promise<Array>} - An array of event objects.
 */
async function parseEventBriteDOM(entryPoint, maxPages, user, password) {
    // Starting puppeteer
    const browser = await puppeteer.launch({
      headless: true
    });

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

    // Login into the eventbrite account
    await wrapperPage.goto('https://www.eventbrite.es/signin/');
    await wrapperPage.waitForSelector('li.eds-global-footer__link-bullet');
    await wrapperPage.click('input[type="email"]');
    await wrapperPage.type('input[type="email"]', user);
    await wrapperPage.click('input[type="password"]');
    await wrapperPage.type('input[type="password"]', password);
    await wrapperPage.click('button[type="submit"]');

    // make the script wait for a random number of seconds between 3 and 5
    await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * (5000 - 3000 + 1)) + 3000));

    // Go to the entry point URL
    const pageUrl = `${entryPoint}`;
    await wrapperPage.goto(pageUrl);

    // make the script wait for a random number of seconds between 3 and 5
    await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * (5000 - 3000 + 1)) + 3000));

    // Selecting all .search-main-content__events-list-item elements  // Selecting all wrapper elements
    let listOfEvents = [];
    let wrapperOfEvents = null;
    try {
        wrapperOfEvents = await wrapperPage.$$('li.search-main-content__events-list-item');
    } catch (error) {
        console.error(`\n\nCouldn't locate wrapper of events in ${entryPoint}\nClosing browser and returining an empty array:\n${error}`);
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
        let item = {source: "eventbrite"};
        let eventPage;

        // Extracting title and link from a wrapper card
        try {
          item.title = await singleEvent.$eval('.discover-search-desktop-card a > h2', (h2) => h2.innerText.trim());
          item.link = await singleEvent.$eval('.discover-search-desktop-card section > a', (a) => a.href);            
        } catch (error) {
            console.error(`\n\nCouldn't retrieve title and link from a ${item.source} wrapper. Jumping to next event:\n${error}`);
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
            console.error(`E\n\nrror opening a tab in ${item.source}, skipping event ${item.link} \n${error}`);
            continue;
        }

        // Extracting Script from HEAD (there are two, $eval selects the first one)
        let scriptContent = null;
        let eventData = null;

        try {
            scriptContent = await eventPage.$eval('script[type="application/ld+json"]', (script) => script.textContent);
            eventData = JSON.parse(scriptContent);
        } catch (error) {
            console.error(`\n\nSkipping and closing tab: Failed locating data script in ${item.link} \n${error}`);
            await eventPage.close();
            continue;
        }

        // Checking if the event is online, in such case, ignore and continue
        const isOnline = EventItem.checkIfOnline(eventData);
        if (isOnline) {continue;}

        // Going after initDate
        try {
            item.initDate = new Date(eventData.startDate);
        } catch (error) {
            console.error(`\n\nSkipping and closing tab: Failed locating start date in ${item.link} \n${error}`);
            await eventPage.close();
            continue;
        }

        // Going after endDate
        try {
          item.endDate = new Date(eventData.endDate);
        } catch (error) {
            console.error(`\n\nFailed locating end date in ${item.link}, setting initDate as endDate:\n${error}`);
            item.endDate = item.initDate;
        }

        // Extracting image url from evenData script
        try {
          // This comes from the single event page, not the script
          item.image = await singleEvent.$eval('.discover-search-desktop-card section > a > div > img', (img) => img.src);
        } catch (error) {
            console.error(`\n\nFailed to obtain image in ${item.link}, setting a default one:\n${error}`);
            item.image = "https://i.imgur.com/S2TINUo.png"; // Logo eventbrite
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
            // Searching for the first .price variable
            for (const offer of eventData.offers) {
              if (offer.price) {
                  item.price = offer.price;
                break;
              }
            }
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

        // Adding the item to the list
        listOfEvents.push(tempItem);

    }

    // For loope ended, close the browser
    console.log("Closing browser in eventbrite");
    await browser.close();
    return listOfEvents;

}


/*
const entryPoint = 'https://www.eventbrite.es/d/united-states/all-events/?page=1&bbox=-8.735923924902409%2C43.182572282775%2C-8.213386693457096%2C43.64991191572349';
const maxPages = 1;

const fs = require('fs');
const authConfig = JSON.parse(fs.readFileSync('./authentication.config.json', 'utf-8'));
const scrapedItems = parseEventBriteDOM(entryPoint, maxPages, authConfig.eventbrite.user, authConfig.eventbrite.password);
*/

module.exports = parseEventBriteDOM;