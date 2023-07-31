const sqlite3 = require('sqlite3');
const fs = require('fs');


/**
 * Represents a database connection using the Singleton pattern.
 * This class is responsible for creating and managing a single database instance.
 * 
 * If the database file does not exist, it creates a new one and the associated table.
 * If the database file already exists, it reuses the existing connection.
 * 
 * The Singleton pattern ensures that only one instance of the database connection
 * exists throughout the application, allowing easy access from different modules by
 * just requiring/importing this class, thus no new instance is needed.
 *
 * @class DatabaseConnection
 * @constructor
 * @param {string} [dbPath=''] - The path to the database file. Defaults to an empty string.
 * @param {string} [tableName=''] - The name of the table to be created. Defaults to an empty string.
 * @throws {Error} If `dbPath` or `tableName` are not provided when creating a new instance, and there's not an existing one.
 */
class DatabaseConnection {
    constructor(dbPath = '', tableName = '') {

    // Check if there's a previously existing instance, and return it
    if (DatabaseConnection.instance) {
      return DatabaseConnection.instance;
    }

    // If there's no such instance, throw an error if arguments are not provided
    if (dbPath == '' || tableName == '') {
      throw new Error('Database path and table name must be provided to create a new instance.');
    }

    this.dbPath = dbPath;
    this.tableName = tableName;

    // If arguments are provided, and there's no DB file yet, create a new one
    if (!fs.existsSync(this.dbPath)) {
      this.db = new sqlite3.Database(this.dbPath);

      const query = `CREATE TABLE ${this.tableName} (
        link TEXT PRIMARY KEY,
        title TEXT,
        price TEXT,
        initDateISO TEXT,
        endDateISO TEXT,
        initDateHuman TEXT,
        endDateHuman TEXT,
        scrapedDateISO TEXT,
        content TEXT,
        image TEXT,
        source TEXT
      )`;

      this.db.run(query);

      console.log(`Database ${this.dbPath} created successfully.`);

    // If arguments are provided, and there's an existing DB file, reuse it
    } else {
      this.db = new sqlite3.Database(this.dbPath);
      console.error(`\n\nDatabase ${this.dbPath} already exists. Reusing the existing connection.`);
    }

    // Store the instance in the Singleton pattern
    DatabaseConnection.instance = this;

    // Prevent any modifications to the class after instantiation
    Object.freeze(this);

    // Return the instance
    return this;

    }

    /**
     * Close the database connection.
     *
     * @param {} - No parameters.
     * @return {} - No return value.
     */
    close() {
        this.db.close();
        delete DatabaseConnection.instance;
    }


    /**
     * Stores the given events in the specified database table.
     *
     * @param {Array} events - An array of events to be stored.
     * @param {string} [tableName=this.tableName] - The table namen. Defaults to the table name specified in the class.
     * @return {Promise} - A promise that resolves when all events have been stored successfully.
     */
    storeEventsInDB(events, tableName = this.tableName) {
        return new Promise((resolve, reject) => {
        for (const singleEvent of events) {
            if (singleEvent.isValidEvent == true) {
            this.db.all(
                `INSERT INTO ${tableName} VALUES (
                '${singleEvent.link}',
                '${singleEvent.title}',
                '${singleEvent.price}',
                '${singleEvent.initDateISO}',
                '${singleEvent.endDateISO}',
                '${singleEvent.initDateHuman}',
                '${singleEvent.endDateHuman}',
                '${singleEvent.scrapedDateISO}',
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
    }

    /**
     * Returns a Promise that resolves with entries from a specified table in a specified schema
     * between two dates.
     *
     * @param {string} initDateISO - the initial date in format 'YYYY-MM-DD'
     * @param {string} endDateISO - the end date in format 'YYYY-MM-DD'
     * @param {string} [tableName=this.tableName] The table name, defaults to this.Tablename
     * @return {Promise<Array>} a Promise that resolves with an array of selected entries
     */
    getEntriesInRange(initDateISO, endDateISO, tableName = this.tableName) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT *
                FROM ${tableName}
                WHERE initDateISO >= '${initDateISO}' AND initDateISO <= '${endDateISO}'
            `;
        
            this.db.all(query, function (err, res) {
                if (err) {
                console.error(err);
                reject(err);
                } else {
                resolve(res);
                }
            });
        });
    }

    /**
     * Retrieves the scraped date from the specified table in the given database for a given link.
     *
     * @param {string} linkToCheck - The link to search for in the table.
     * @param {string} [tableName=this.tableName] - The name of the table to query.
     * @return {Promise<string|null>} A promise that resolves to a JS Date object if the link is found, or null if was not.
     */
    checkLinkInDB(linkToCheck, tableName=this.tableName) {
        const query = `SELECT scrapedDateISO FROM ${tableName} WHERE link = '${linkToCheck}'`;
    
        return new Promise((resolve, reject) => {
        this.db.get(query, (err, row) => {
            if (err) {
            reject(err); // An error occurred while querying the database
            } else {
            
            try {
                // If the link was found, return the scraped date, otherwise return null
                const jsDate = new Date(row.scrapedDateISO);
                const scrapedDate = row ? jsDate : null;
                resolve(scrapedDate);
            } catch (error) {
                resolve(null);
            }
            }
        });
        });
    }


}

module.exports = DatabaseConnection;
