const puppeteer = require('puppeteer');
const crypto = require('crypto');
const utils = require('../../utils.js');

/**
 * Parses the Ataquilla DOM to scrape events and returns a list of event items.
 *
 * @param {string} entryPoint - The entry point URL for scraping events.
 * @param {number} maxPages - The maximum number of pages to scrape.
 * @param {string} uniqueProjectUUIDNamespace - The namespace for generating unique UUIDs.
 * @return {Promise<Array>} A Promise that resolves to an array of event items.
 */
async function parseAtaquillaDOM(entryPoint, maxPages) {
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

    // Loop for iterating through the pagination URLs
    for (let pagination = 1; pagination <= maxPages; pagination++) {
      const pageUrl = `${entryPoint}&p=${pagination}`;
      await page.goto(pageUrl);

      // Wait for the DOM to load (ID appearing in the footer)
      await page.waitForSelector('#ataquilla-social-block');

      // Selecting all .wrapper elements
      const wrapperElements = await page.$$('.wrapper');
      

      for (const element of wrapperElements) {
        // Sometimes one selectors are not there, so if the scrapers fails to 
        // find the element, we skip it
        let item;
        try {
          item = {
            title: await element.$eval('a[itemprop="url"]', (a) => a.innerText.trim()),
            link: await element.$eval('a[itemprop="url"]', (a) => a.href),
            price: await element.$eval('strong[itemprop="lowPrice"]', (strong) => strong.innerText.trim()),
            initDate: await element.$eval('time', (time) => time.getAttribute('datetime')),
            endDate: await element.$eval('time', (time) => time.getAttribute('datetime')),
            content: "",
            image: await element.$eval('img[itemprop="image"]', (img) => img.src),
            source: "Ataquilla",
          };

          // If price is "" then set "Free or unavailable"
          if (item.price === "") {item.price = "Free or unavailable";}

          // Generamos el hash de la URL utilizando SHA-256 (será la PK de la BD)
          const urlHash = crypto.createHash('sha256').update(item.link).digest('hex');
          item.hash = urlHash;

          // Transforming dates to DuckDB Format
          item.initDate = utils.convertISOToDuckDBTimestamp(item.initDate);
          item.endDate = utils.convertISOToDuckDBTimestamp(item.endDate);

          // Adding the item to the list
          listOfEvents.push(item);

        } catch(error) {
          console.error("Failed to scrape some Ataquilla Item: " + error);
          // skip to next item if some current item evaluation fails
          continue;
        }
      }
    }
    console.log("Closing browser in Ataquilla");
    await browser.close();
    return listOfEvents;
  } catch (error) {
    console.error(error);
    return [];
  }
}

/*
const entryPoint = 'https://entradas.ataquilla.com/ventaentradas/es/buscar?orderby=next_session&orderway=asc&search_query=Encuentra+tu+evento&search_city=A+Coru%C3%B1a&search_category=';
const maxPages = 1;
const uniqueProjectUUIDNamespace = '1c9aafd0-0a15-11ee-be56-0242ac120002';

const scrapedItems = parseAtaquillaDOM(entryPoint, maxPages, uniqueProjectUUIDNamespace);
*/

module.exports = parseAtaquillaDOM;