const duckdb = require("duckdb");
const fs = require('fs');
const utils = require('./utils.js');

/**
 * Creates a new database in the specified path if it does not exist.
 *
 * @param {string} dbPath - The path to the database.
 * @param {string} schema - The schema of the table.
 * @param {string} tableName - The name of the table.
 * @return {object} - Returns the newly created database. 
 */
function crearBaseDeDatos(dbPath, schema, tableName) {
    let miBaseDuckDb;
    if (!fs.existsSync(dbPath)) {
      miBaseDuckDb = new duckdb.Database(dbPath);
    
      miBaseDuckDb.all(`CREATE TABLE ${schema}.${tableName} (
        uuid UUID PRIMARY KEY,
        title VARCHAR,
        link VARCHAR,
        price VARCHAR,
        initDate TIMESTAMP,
        endDate TIMESTAMP,
        content VARCHAR,
        image VARCHAR,
        source VARCHAR
      )`, function (err, response) {if (err) throw err;});
    
      console.log(`Database ${dbPath} created successfully.`);
    } else {
      // Al parecer esta sintaxis solo crea el archivo si no existe. Si lo hay,
      // simplemente se conecta a la BD existente.
      miBaseDuckDb = new duckdb.Database(dbPath);
      console.error(`Database ${dbPath} already exists. Passing ${miBaseDuckDb}`);
    }
    
    return miBaseDuckDb;
}

  /**
 * Stores events in a specified schema and table in the given miBaseDuckDb database.
 *
 * @param {Object} miBaseDuckDb - the miBaseDuckDb database object.
 * @param {string} schema - the name of the schema to store events.
 * @param {string} tableName - the name of the table to store events.
 * @param {Array} events - an array of event objects to insert into the schema and table.
 * @return {Promise} A promise that resolves when all events have been inserted.
 */
function storeEventsInDB(miBaseDuckDb, schema, tableName, events) {
    return new Promise((resolve, reject) => {
      events.forEach(event => {
        // Sanitize some strings before inserting
        sanitizedTitle = utils.sanitizeStringForDuckDB(event.title);
        sanitizedPrice = utils.sanitizeStringForDuckDB(event.price);
        sanitizedContent = utils.sanitizeStringForDuckDB(event.content);

        miBaseDuckDb.all(
          `INSERT INTO ${schema}.${tableName} VALUES (
          '${event.uuid}',
          '${sanitizedTitle}',
          '${event.link}',
          '${sanitizedPrice}',
          '${event.initDate}',
          '${event.endDate}',
          '${sanitizedContent}',
          '${event.image}',
          '${event.source}'
          )`,
          function(err, res) {if (err) {console.error(err);}});
        }); // -> Closing foreach, hate it when there's 3000 brackets
        // Solve the promise when all the events are inserted, despite errors,
        // so no intention to reject the promise.
        resolve();
      })
}

/**
 * Returns a Promise that resolves with entries from a specified table in a specified schema
 * between two dates.
 *
 * @param {Object} miBaseDuckDb - the database connection object
 * @param {string} schema - the schema name
 * @param {string} tableName - the table name
 * @param {string} initDate - the initial date in format 'YYYY-MM-DD'
 * @param {string} endDate - the end date in format 'YYYY-MM-DD'
 * @return {Promise<Array>} a Promise that resolves with an array of selected entries
 */
function getEntriesInRange(miBaseDuckDb, schema, tableName, initDate, endDate) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT *
        FROM ${schema}.${tableName}
        WHERE initDate >= '${initDate}' AND initDate <= '${endDate}'
      `;
  
      miBaseDuckDb.all(query, function (err, res) {
        if (err) {
          console.error(err);
          reject(err);
        } else {
          resolve(res);
        }
      });
    });
}


module.exports = {
    crearBaseDeDatos,
    storeEventsInDB,
    getEntriesInRange
  }