/*
Meetup closed down their API behind hefty payments.

Their web search function is also poor in regards to finding events.

So the only way to make this work is to manually check for active Meetup groups.

List of groups comes from Main.js passed as entryPoints
*/

const puppeteer = require('puppeteer');
const crypto = require('crypto');
const utils = require('../../utils.js');



/**
 * Parses the Meetup DOM to extract event information.
 *
 * @param {Array} entryPoints - An array of URLs representing the entry points to scrape.
 * @param {number} maxPages - The maximum number of pages to scrape.
 * @return {Promise<Array>} A promise that resolves to an array of event objects.
 */
async function parseMeetupDOM(entryPoints, maxPages) {
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
  
      // Loop for iterating through all the entrypoints
      for (let meetupGroupURL of entryPoints) {
        const pageUrl = meetupGroupURL;
        await page.goto(pageUrl);
  
        // Wait till network is idle (DOM takes time to load in Meetup and there's no clear selector)
        await page.waitForSelector('#a11y-status-message');
  
        // Selecting all .eventList .eventCard elements (wrapper selector)
        const wrapperElements = await page.$$('.eventList .eventCard');
        
  
        for (const element of wrapperElements) {
          // Sometimes one selectors are not there, so if the scrapers fails to 
          // find the element, we skip it
          let item;
          try {
            item = {
              title: await element.$eval('h2 > div > a', (a) => a.innerText.trim()),
              link: await element.$eval('h2 > div > a', (a) => a.href),
              price: "", // Set in a block below
              initDate: await element.$eval('time', (time) => time.getAttribute('datetime')),
              endDate: await element.$eval('time', (time) => time.getAttribute('datetime')),
              content: await element.$eval('p.description-markdown--p', (p) => p.innerText.trim()),
              image: "",    // Obtained from the event URL below
              source: "Meetup",
            };
  
            // If price is "" or fails then set "Free or unavailable"
            // Most meetups won't have any price, but this way if price retrieval
            // fails we don't ditch the whole event
            try {
                const priceList = await element.$x('//span[contains(text(), "€")]');
                const price = await priceList[0].getProperty('textContent');
                item.price = await price.jsonValue();
            } catch (error) {
                item.price = "Free or unavailable";
            } finally {
                if (item.price === "") {item.price = "Free or unavailable";}
            }

            // Navigating to item.link and getting the event image
            const eventPage = await browser.newPage();
            await eventPage.goto(item.link);
            await page.waitForSelector('#a11y-status-message');
            try {
                item.image = await eventPage.$eval('div[data-event-label="event-home"] img', (img) => img.getAttribute('src'));
            } catch (error) {
                item.image = "https://i.imgur.com/Uo8hsw3.png";
            }
            eventPage.close();
  
            // Generamos el hash de la URL utilizando SHA-256 (será la PK de la BD)
            const urlHash = crypto.createHash('sha256').update(item.link).digest('hex');
            item.hash = urlHash;
  
            // Transforming dates to DuckDB Format
            // We have to transform Unix epoch to ISO-8601 and then to DuckDB Timestamp
            item.initDate = utils.convertUnixEpochToISO8601(item.initDate);
            item.endDate = utils.convertUnixEpochToISO8601(item.endDate);

            item.initDate = utils.convertISOToDuckDBTimestamp(item.initDate);
            item.endDate = utils.convertISOToDuckDBTimestamp(item.endDate);
  
            // Adding the item to the list
            listOfEvents.push(item);
  
          } catch(error) {
            console.error("Failed to scrape some Meetup Item: " + error);
            // skip to next item if some current item evaluation fails
            eventPage.close();
            continue;
          }
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
const activeMeetupGroups = [
"https://www.meetup.com/a-coruna-cork-y-canvas-sessions/events/",
"https://www.meetup.com/es-ES/a-coruna-expats/events/"

];
const maxPages = 1;

const scrapedItems = parseMeetupDOM(activeMeetupGroups, maxPages);
*/
  
module.exports = parseMeetupDOM;