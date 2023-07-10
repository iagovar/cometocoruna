const puppeteer = require('puppeteer');
const crypto = require('crypto');
const utils = require('../../utils.js');


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
  try {
    const listOfEvents = [];

    // Starting puppeteer
    const browser = await puppeteer.launch({
      headless: true
    });
    
    const page = await browser.newPage();

    // Additional browser configuration
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.150 Safari/537.36'
    );
    await page.setJavaScriptEnabled(true);
    await page.setViewport({
      width: 1024,
      height: 768,
      deviceScaleFactor: 1
    })

    // Login into the eventbrite account
    await page.goto('https://www.eventbrite.es/signin/');
    await page.waitForSelector('li.eds-global-footer__link-bullet');
    await page.click('input[type="email"]');
    await page.type('input[type="email"]', user);
    await page.click('input[type="password"]');
    await page.type('input[type="password"]', password);
    await page.click('button[type="submit"]');

    // make the script wait for a random number of seconds between 3 and 5
    await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * (5000 - 3000 + 1)) + 3000));

    // Go to the entry point URL
    const pageUrl = `${entryPoint}`;
    await page.goto(pageUrl);

    // make the script wait for a random number of seconds between 3 and 5
    await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * (5000 - 3000 + 1)) + 3000));

    // Selecting all wrapper elements
    const wrapperElements = await page.$$('li.search-main-content__events-list-item');
    
    for (const element of wrapperElements) {
    // Sometimes one selectors are not there, so if the scrapers fails to 
    // find the element, we skip it
    let item;
    try {
        item = {
        title: await element.$eval('.discover-search-desktop-card a > h2', (h2) => h2.innerText.trim()),
        link: await element.$eval('.discover-search-desktop-card section > a', (a) => a.href),
        price: "",
        initDate: "",
        endDate: "",
        content: "",
        image: await element.$eval('.discover-search-desktop-card section > a > div > img', (img) => img.src),
        source: "eventbrite",
        };

        // Navigating to item.link and getting the event content, price and date
        const eventPage = await browser.newPage();
        await eventPage.goto(item.link);

        // make the script wait for a random number of seconds between 10 and 12
        await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * (10000 - 12000 + 1)) + 10000));

        // Extracting Script from HEAD (there are two, $eval selects the first one)
        let scriptContent = null;
        try {
            scriptContent = await eventPage.$eval('script[type="application/ld+json"]', (script) => script.textContent);
        } catch (error) {
            console.error(error);
            eventPage.close();
            continue;
        }
        // Parsing text from the script as JSON
        const eventData = JSON.parse(scriptContent);

        // Going after the dates
        try {
            item.initDate = eventData.startDate;
            item.endDate = eventData.endDate;
        } catch (error) {
            // If retrieving the date fails, just pass onto the next element
            eventPage.close();
            continue;
        }

        // Going after the content
        try {
            item.content = eventData.description;
        } catch (error) {
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
            // If price is "" then set "Free or unavailable"
            if (
                item.price === ""
                || item.price === "0.00"
                || item.price === 0 
                || item.price === 0.00
                ) {item.price = "Free or unavailable";}
        } catch (error) {
            item.price = "Free or unavailable";
        }
        eventPage.close();

        // Generamos el hash de la URL utilizando SHA-256 (será la PK de la BD)
        const urlHash = crypto.createHash('sha256').update(item.link).digest('hex');
        item.hash = urlHash;

        // Transforming dates to DuckDB Format
        item.initDate = utils.convertISOToDuckDBTimestamp(item.initDate);
        item.endDate = utils.convertISOToDuckDBTimestamp(item.endDate);

        // Adding the item to the list
        listOfEvents.push(item);

    } catch(error) {
        console.error("Failed to scrape some Eventbrite Item: " + error);
        // skip to next item if some current item evaluation fails
        eventPage.close();
        continue;
    }
    }

    await browser.close();
    return listOfEvents;
  } catch (error) {
    console.error(error);
    return [];
  }
}

/*
const entryPoint = 'https://www.eventbrite.es/d/united-states/all-events/?page=1&bbox=-8.735923924902409%2C43.182572282775%2C-8.213386693457096%2C43.64991191572349';
const maxPages = 1;


const scrapedItems = parseEventBriteDOM(entryPoint, maxPages, "iagovar@outlook.com", "Mandacarallo2");
*/

module.exports = parseEventBriteDOM;