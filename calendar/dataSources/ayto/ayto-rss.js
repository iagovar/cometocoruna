/*

Script para obtener el contenido del RSS del Ayto de A Coruña.

Usando el paquete rss-parser para obtener los datos: https://www.npmjs.com/package/rss-parser

---

El RSS del Ayto contiene items con la siguiente estructura:

title: Autoexplicativo
link: URL del evento
pubDate: Fecha de publicación
isoDate: Fecha en formato  ISO 8601, machine readable: 2023-05-14T22:00:00.000Z
content: Descripción del evento
guid: En este caso el global unique identifier es la URL del evento

¡Ojo! Hay elementos que rss-parser no parsea, como los <media:etc> por algún motivo
Usaremos:

itunes:summary: Descripción del evento (accediendo con ['itunes']['summary'])
itunes:image: URL de la imagen del evento (accediendo con ['itunes']['image'])

Es necesario generar un uuid para cada item con la librería uuid.

TODO: Hay que scrapear las fechas, las del RSS son muy vagas y se necesita fecha
de inicio y de fin, no de publicación

*/

const Parser = require('rss-parser');
const parser = new Parser();

const { v5: uuidv5 } = require('uuid');

const utils = require('../../utils.js');

const cheerio = require('cheerio');
const axios = require('axios');

/**
 * Parses the A Coruna Municipality feed from a given URL and creates a list of objects formatted
 * for the destination database schema.
 *
 * @async
 * @param {string} url - The URL of the Ayto feed.
 * @param {string} uniqueProjectUUIDNamespace - The UUID namespace for generating unique IDs.
 * @returns {Promise<Array>} - A Promise that resolves to an array of objects with UUID, title,
 * link, initDate, endDate, content, image, and source properties.
 */
async function parseAytoFeed(url, uniqueProjectUUIDNamespace) {
    let feed = await parser.parseURL(url);

    // Creamos una lista de todos los objetos formateados correctamente para
    // el destino (ver main.js para el schema de la DB)
    const listOfObjects = [];

    for (let item of feed.items) {
        // Generamos un UUID para cada item
        const seed = item.link + item.content;
        const tempuuid = uuidv5(seed, uniqueProjectUUIDNamespace);

        // Obtenemos fechas con scraping
        // TODO hay muchos undefineds, errores de retrieval y fechas que no cuadran de formato
        const tempScrapedDataObj = await scrapeDatesAndPrices(item.link, item.pubDate);

        // Convertimos fechas
        const tempInitialDate = utils.convertISOToDuckDBTimestamp(item.pubDate);
        const tempEndDate = utils.convertISOToDuckDBTimestamp(item.pubDate);

        listOfObjects.push({
            uuid: tempuuid,
            title: item.title,
            link: item.link,
            price: tempScrapedDataObj.retrievedPrice,
            initDate: tempInitialDate,
            endDate: tempEndDate,
            content: item.content,
            image: item['itunes']['image'],
            source: "ayto"
        })
    }

    return listOfObjects;
}



/**
 * Scrape dates and prices from a URL using Cheerio and Axios.
 *
 * @param {string} url - URL to scrape.
 * @param {string} alternativeDate - ISO 8601 date string to use if date is invalid.
 * @return {Object} Object with retrievedPrice, initDate, and endDate properties.
 */
async function scrapeDatesAndPrices(url, alternativeDate) {
    let initDate;
    let endDate;
    let retrievedPrice;
  
    try {
      const response = await axios.get(url);
      const htmlContent = response.data;
      const cheerioInstance = cheerio.load(htmlContent);
  
      // Selection of the meta element with the "startDate" property
      const startDateMeta = cheerioInstance('meta[property="startDate"]');
      
      // Retrieval of the value of the "content" attribute and removal of the last character
      // Dates usually come in the format 2023-07-05 21:00:00.0 and need to be
      // converted to 2023-07-05 21:00:00 by removing the last ".n"
      initDate = startDateMeta.attr('content').slice(0, -2);
  
      // Selection of the meta element with the "endDate" property
      const endDateMeta = cheerioInstance('meta[property="endDate"]');
      
      // Retrieval of the value of the "content" attribute and removal of the last character
      endDate = endDateMeta.attr('content').slice(0, -2);
  
      // Selection of the div element with the "price" property
      const priceDiv = cheerioInstance('div.preciosuceso[property="offers"] p');
  
      // retrieval of the value of the p element containing the price
      retrievedPrice = priceDiv.text()
  
      // If dates are not valid, use alternativeDate
      if (!utils.isValidISODate8601(initDate) || !utils.isValidISODate8601(endDate)) {
        initDate = alternativeDate;
        endDate = alternativeDate;
      }
  
      const scrapedData = {
        "retrievedPrice": retrievedPrice,
        "initDate": initDate,
        "endDate": endDate
      };
  
      return scrapedData;
    } catch (error) {
      console.log(error); // Error handling
  
      const scrapedData = {
        "retrievedPrice": "Precio no disponible, consulta el enlace",
        "initDate": alternativeDate,
        "endDate": alternativeDate
      };
  
      return scrapedData;
    }

}
  



// Exportamos el módulo
module.exports = parseAytoFeed;