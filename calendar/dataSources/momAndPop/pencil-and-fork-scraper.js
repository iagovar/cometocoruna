const { AbstractDomScraper } = require('../../scraperClass.js');
const { EventItem } = require('../../eventClass.js');
const puppeteer = require('puppeteer');
const { convert } = require('html-to-text');


async function parsePencilAndFork(url, authConfigObj) {

    // Loading class
    let PencilAndFork = new AbstractDomScraper(
        url,
        0, // no max pages required
        authConfigObj,
        'puppeteer' // library we'll use
    )

    // Launch browser
    const browser = await PencilAndFork.launchBrowser();

    // Retrieving wrapper page
    const wrapperPage = await PencilAndFork.getWrapperPage();

    // In the Pencil and Fork website, all event data is contained in a JSON
    // script tag in the wrapper page already

    let scriptContent;
    let eventsData;
    try {
        scriptContent = await wrapperPage.$eval('.tribe-common script[type="application/ld+json"]', (script) => script.textContent);
        eventsData = JSON.parse(scriptContent);
    } catch (error) {
        console.error(`\n\nSkipping Pencil And Fork: Error retrieving JSON from ${url} \n${error}`);
    }

    // Parsing all events data
    for (const singleEvent of eventsData) {
        
        let prices;
        let priceRangeString;

        if (Array.isArray(singleEvent.offers)) {
            prices = singleEvent.offers.map(offer => parseFloat(offer.price));
            priceRangeString = `From ${Math.min(...prices).toFixed(2)}€ to ${Math.max(...prices).toFixed(2)}€`;
        } else {
            priceRangeString = `No price available`;
        }

        const tempEvent = new EventItem(
            singleEvent.name,
            singleEvent.url,
            priceRangeString,
            convert(singleEvent.description),
            singleEvent.image,
            'pencilandfork',
            new Date(singleEvent.startDate),
            new Date(singleEvent.endDate)
          );

        PencilAndFork.listOfEvents.push(tempEvent);
    }

    return PencilAndFork.listOfEvents;

}

/*
const url = 'https://pencilandfork.es/cursos-y-talleres/'

parsePencilAndFork(url);
*/

module.exports = parsePencilAndFork;