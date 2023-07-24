const duckdb = require("duckdb");
const fs = require('fs');

/**
 * Creates a new database in the specified path if it does not exist.
 *
 * @param {string} dbPath - The path to the database.
 * @param {string} schema - The schema of the table.
 * @param {string} tableName - The name of the table.
 * @return {object} - Returns the newly created database. 
 */
function createDataBase(dbPath, schema, tableName) {
    let miBaseDuckDb;
    if (!fs.existsSync(dbPath)) {
      miBaseDuckDb = new duckdb.Database(dbPath);
    
      miBaseDuckDb.all(`CREATE TABLE ${schema}.${tableName} (
        link VARCHAR PRIMARY KEY,
        title VARCHAR,
        price VARCHAR,
        initDateISO TIMESTAMP,
        endDateISO TIMESTAMP,
        initDateHuman VARCHAR,
        endDateHuman VARCHAR,
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
    for (const singleEvent of events) {
      if (singleEvent.isValidEvent == true) {
          miBaseDuckDb.all(
            `INSERT INTO ${schema}.${tableName} VALUES (
            '${singleEvent.link}',
            '${singleEvent.title}',
            '${singleEvent.price}',
            '${singleEvent.initDateISO}',
            '${singleEvent.endDateISO}',
            '${singleEvent.initDateHuman}',
            '${singleEvent.endDateHuman}',
            '${singleEvent.content}',
            '${singleEvent.image}',
            '${singleEvent.source}'
            )`,
            function(err, res) {
              if (err) {
                console.error(`Error storing in DB:\n${err}\nEvent producing error in DB is:\n${JSON.stringify(singleEvent)}`);
                ;}
            });  
      };
    };
    // Loop finished, resolve the promise
    resolve();
  });
};

/**
 * Returns a Promise that resolves with entries from a specified table in a specified schema
 * between two dates.
 *
 * @param {Object} miBaseDuckDb - the database connection object
 * @param {string} schema - the schema name
 * @param {string} tableName - the table name
 * @param {string} initDateISO - the initial date in format 'YYYY-MM-DD'
 * @param {string} endDateISO - the end date in format 'YYYY-MM-DD'
 * @return {Promise<Array>} a Promise that resolves with an array of selected entries
 */
function getEntriesInRange(miBaseDuckDb, schema, tableName, initDateISO, endDateISO) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT *
        FROM ${schema}.${tableName}
        WHERE initDateISO >= '${initDateISO}' AND initDateISO <= '${endDateISO}'
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
    createDataBase,
    storeEventsInDB,
    getEntriesInRange
  }