const sqlite3 = require("sqlite3");
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
    let myDatabase;
    if (!fs.existsSync(dbPath)) {
      myDatabase = new sqlite3.Database(dbPath);

      const query = `CREATE TABLE ${tableName} (
        link TEXT PRIMARY KEY,
        title TEXT,
        price TEXT,
        initDateISO TEXT,
        endDateISO TEXT,
        initDateHuman TEXT,
        endDateHuman TEXT,
        content TEXT,
        image TEXT,
        source TEXT
      )`

      myDatabase.run(query);
    
      console.log(`Database ${dbPath} created successfully.`);
    } else {
      // Al parecer esta sintaxis solo crea el archivo si no existe. Si lo hay,
      // simplemente se conecta a la BD existente.
      myDatabase = new sqlite3.Database(dbPath);
      console.error(`\n\nDatabase ${dbPath} already exists. Passing ${myDatabase}`);
    }
    
    return myDatabase;
}

  /**
 * Stores events in a specified schema and table in the given miBaseDuckDb database.
 *
 * @param {Object} myDatabase - the myDatabase database object.
 * @param {string} schema - the name of the schema to store events.
 * @param {string} tableName - the name of the table to store events.
 * @param {Array} events - an array of event objects to insert into the schema and table.
 * @return {Promise} A promise that resolves when all events have been inserted.
 */
function storeEventsInDB(myDatabase, schema, tableName, events) {
  return new Promise((resolve, reject) => {
    for (const singleEvent of events) {
      if (singleEvent.isValidEvent == true) {
        myDatabase.all(
            `INSERT INTO ${tableName} VALUES (
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
                console.error(`\n\nError storing in DB:\n${err}\nEvent producing error in DB is:\n${JSON.stringify(singleEvent)}`);
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
 * @param {Object} myDatabase - the database connection object
 * @param {string} schema - the schema name
 * @param {string} tableName - the table name
 * @param {string} initDateISO - the initial date in format 'YYYY-MM-DD'
 * @param {string} endDateISO - the end date in format 'YYYY-MM-DD'
 * @return {Promise<Array>} a Promise that resolves with an array of selected entries
 */
function getEntriesInRange(myDatabase, schema, tableName, initDateISO, endDateISO) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT *
        FROM ${tableName}
        WHERE initDateISO >= '${initDateISO}' AND initDateISO <= '${endDateISO}'
      `;
  
      myDatabase.all(query, function (err, res) {
        if (err) {
          console.error(err);
          reject(err);
        } else {
          resolve(res);
        }
      });
    });
}


/*

async function test() {
      const events = [
      {"title":"Cinenterraza 2023: “Cult movies”","link":"https://www.coruna.gal/web/gl/actualidade/axenda/axenda-eventos/evento/cinenterraza-2023-cult-movies/suceso/1453839797768","price":"Prezo: 3,00 €DescontosCarné Xove, + 65 anos ou persoas desempregadas 2,00 €","content":"Propostas para espectadoras e cinéfilas de todo tipo e condición e para converter un ano máis o vestíbulo do Fórum Metropolitano nun templo do cinema de culto.","image":"https://www.coruna.gal/IMG/P_Suceso_1453839795668_1099934327828_250_250_U_ce49e5d6cefe823f4677d01b4cf320.png","source":"aytoCoruna","initDate":"2023-07-05 00:00:00.0","endDate":"2023-07-27 00:00:00.0","initDateISO":"2023-07-05T00:00:00+02:00","endDateISO":"2023-07-27T00:00:00+02:00","initDateHuman":"Wednesday, 05, 00:00","endDateHuman":"Thursday, 27, 00:00","scrapedDateISO":"2023-07-25T12:40:18+02:00","hash":"9ba261fac22e30ffecbbc5bb261323b12b33518c1399e3e467455cf30683b932","isValidEvent":true},
      {"title":"Festival \"Pétalos de Igualdade. Flor de vida","link":"https://www.coruna.gal/web/gl/actualidade/axenda/axenda-eventos/evento/festival-petalos-de-igualdade-flor-de-vida/suceso/1453837914290","price":"de balde ​​​​​​​ ​​​","content":"O grupo Cantometrics e o dúo Barahúnda ofrécennos un duplo concerto para a nova edición do festival Pétalos de igualdade. Flor de vida.\r\n","image":"https://www.coruna.gal/IMG/P_Suceso_1453837914290_1099934327828_250_250_U_6ef8679b6a6ae6be554ee1bfdeedd3fa.png","source":"aytoCoruna","initDate":"2023-07-27 00:00:00.0","endDate":"2023-07-27 00:00:00.0","initDateISO":"2023-07-27T00:00:00+02:00","endDateISO":"2023-07-27T00:00:00+02:00","initDateHuman":"Thursday, 27, 00:00","endDateHuman":"Thursday, 27, 00:00","scrapedDateISO":"2023-07-25T12:40:19+02:00","hash":"e53e0751c94c052fc441ca0d4939bfd3455cf33d5add9016eed076f41ee2c2f8","isValidEvent":true}
    ]
    const myDatabase = createDataBase("./cometocoruna.db", "events", "feed");
    await new Promise(resolve => setTimeout(resolve, 1000));
    await storeEventsInDB(myDatabase, "schema", "feed", events);
    const initDateISO = "2023-07-27T00:00:00+02:00";
    const endDateISO = "2023-07-27T00:00:00+02:00";
    const entries = await getEntriesInRange(myDatabase, "schema", "feed", initDateISO, endDateISO)
    console.log(entries)
}

test()
*/

module.exports = {
    createDataBase,
    storeEventsInDB,
    getEntriesInRange
  }