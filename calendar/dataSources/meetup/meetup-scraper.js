/*
Meetup closed down their API behind hefty payments.

Their web search function is also poor in regards to finding events.

So the only way to make this work is to manually check for active Meetup groups.

List of groups comes from Main.js passed as entryPoints
*/

const puppeteer = require('puppeteer');
const { convert } = require('html-to-text');
const { EventItem } = require('../../eventClass.js');



/**
 * Parses the Meetup DOM to extract event information.
 *
 * @param {Array} entryPoints - An array of URLs representing the entry points to scrape.
 * @param {number} maxPages - The maximum number of pages to scrape.
 * @return {Promise<Array>} A promise that resolves to an array of event objects.
 */
async function parseMeetupDOM(entryPoints, maxPages) {
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

    // Define some variables so they can be accesed from above the scope
    let listOfEvents = [];
  
    // Go to the entry point URL
    // Remember that entrypoints are meetup group urls
    for (const entryPoint of entryPoints) {
        const pageUrl = `${entryPoint}`;
        await wrapperPage.goto(pageUrl);
    
        // make the script wait for a random number of seconds between 3 and 5
        await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * (5000 - 3000 + 1)) + 3000));

        // Selecting all wrapper elements
        let wrapperOfEvents = null;
        try {
            wrapperOfEvents = await wrapperPage.$$('.eventList .eventCard');
        } catch (error) {
            console.error(`\n\nCouldn't locate wrapper of events in ${entryPoint}\nClosing browser and returining an empty array: ${error}`);
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
            let item = {source: "meetup"};
            let eventPage;
            
            // Extracting title and link from a wrapper card
            try {
                item.title = await singleEvent.$eval('h2 > div > a', (a) => a.innerText.trim());
                item.link = await singleEvent.$eval('h2 > div > a', (a) => a.href);            
            } catch (error) {
                console.error(`\n\nCouldn't retrieve title and link from a ${item.source} wrapper \nJumping to next event: ${error}`);
                continue;
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

            // Extracting Script with event info from HEAD
            // Because there are multiple scripts in the head, we'll get all and select the one
            // where @type contains 'event' case-insensitive
            let collectionOfScripts = null;
            let eventData = null;
            try {
                // Selectig and storing all scripts
                collectionOfScripts = await eventPage.$$eval('script[type="application/ld+json"]', elements => elements.map(element => element.textContent));
                
                // Iterating over all scripts looking for @type: '*event*' or '*Event'
                for (const singleScript of collectionOfScripts) {
                    const jsonContent = JSON.parse(singleScript);
                    const type = jsonContent["@type"];

                    //  This line checks if the variable type is truthy
                    // (not null, undefined, empty string, or false) and if
                    //  its lowercase version contains the word "event".
                    if (type && type.toLowerCase().includes("event")) {
                        eventData = jsonContent;
                    }
                }
            } catch (error) {
                console.error(`\n\nSkipping and closing tab: Failed locating data script in ${item.link} \n${error}`);
                await eventPage.close();
                continue;
            }

            // Going after initDate
            try {
                item.initDate = eventData.startDate;
            } catch (error) {
                console.error(`\n\nSkipping and closing tab: Failed locating start date in ${item.link} \n${error}`);
                await eventPage.close();
                continue;
            }

            // Going after endDate
            try {
                item.endDate = eventData.endDate;
            } catch (error) {
                console.error(`\n\nFailed locating end date in ${item.link}, setting initDate as endDate:\n${error}`);
                item.endDate = item.initDate;
            }

            // Extracting image url from evenData script
            try {
                // Use the ternary operator to handle the case when eventData.image is an array
                item.image = Array.isArray(eventData.image) ? eventData.image[0] : eventData.image;
            } catch (error) {
                console.error(`\n\nFailed to obtain image in ${item.link}, setting a default one:\n${error}`);
                item.image = "https://i.imgur.com/Uo8hsw3.png"; // Logo meetup
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
                // Price is typically not present in the JSON data for some reason, we have to try and get
                // it through selector on the wrapper's page singleEvent (not eventPage)
                const priceList = await singleEvent.$x('//span[contains(text(), "€")]');
                const price = await priceList[0].getProperty('textContent');
                item.price = await price.jsonValue();
            } catch (error) {
                console.error(`\n\nFailed to obtain price in ${item.link}, setting it to 'Free or unavailable':\n${error}`);
                item.price = "Free or unavailable";
            } finally {
                if (item.price === "") {item.price = "Free or unavailable";}
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
    }

    // For loope ended, close the browser
    console.log("Closing browser in Meetup");
    await browser.close();
    return listOfEvents;
}

/*
const activeMeetupGroups = [
"https://www.meetup.com/a-coruna-cork-y-canvas-sessions/events/",
"https://www.meetup.com/es-ES/a-coruna-expats/events/"

];
const maxPages = 1;

const scrapedItems = parseMeetupDOM(activeMeetupGroups, maxPages);
*/
  
module.exports = parseMeetupDOM;