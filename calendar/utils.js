/**
 * Converts an ISO-8601 formatted date string to a DuckDB compatible timestamp string.
 * 
 * Example: 2023-06-26T22:00:00.000Z
 *
 * @param {string} isoDate8601 - The ISO-8601 formatted date string to be converted.
 * @return {string} The converted DuckDB compatible timestamp string.
 */
function convertISOToDuckDBTimestamp(isoDate8601) {
    const dateObj = new Date(isoDate8601);
  
    const year = dateObj.getUTCFullYear();
    const month = (dateObj.getUTCMonth() + 1).toString().padStart(2, '0');
    const day = dateObj.getUTCDate().toString().padStart(2, '0');
    const hours = dateObj.getUTCHours().toString().padStart(2, '0');
    const minutes = dateObj.getUTCMinutes().toString().padStart(2, '0');
    const seconds = dateObj.getUTCSeconds().toString().padStart(2, '0');
  
    const duckDBTimestamp = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  
    return duckDBTimestamp;
  }

/**
 * Checks if the given value is a valid ISO 8601 date string.
 * 
 * Example: 2023-06-26T22:00:00.000Z
 *
 * @param {string} value - The value to be tested.
 * @return {boolean} Returns true if the value is a valid ISO 8601 date string, otherwise false.
 */
function isValidISODate8601(value) {
  const regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
  return regex.test(value);
}

/**
 * Returns the current date in the format of 'YYYY-MM-DD'.
 *
 * @return {string} The current date in the format of 'YYYY-MM-DD'.
 */
function getCurrentDateTimestampFormat() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns a future date timestamp formatted as "YYYY-MM-DD" based on the number 
 * of days from today.
 *
 * @param {number} numDays - The number of days from today to calculate the future date.
 * @return {string} The future date timestamp in the format "YYYY-MM-DD".
 */
function getFutureDateTimestampFormat(numDays) {
  const today = new Date();
  const futureDate = new Date(today.getTime() + numDays * 24 * 60 * 60 * 1000);
  const year = futureDate.getFullYear();
  const month = String(futureDate.getMonth() + 1).padStart(2, '0');
  const day = String(futureDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}



/**
 * Takes an integer or a Date object and returns an object containing the name of the day,
 * the day number, and the hour in a specific format. If the input is an integer, it adds the
 * specified number of days to the current date. If the input is a Date object, it extracts
 * the day and weekday information from it. Throws an error if the input is neither an integer
 * nor a Date object.
 *
 * @param {number | Date} input - The number of days to add to the current date or a Date object.
 * @return {Object} An object containing the name of the day, the day number, and the hour in a
 * specific format.
 */
function getDateShortName(input) {
  const weekDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const today = new Date();

  let weekDay = null;
  let day = null;
  let hour = null;

  if (Number.isInteger(input)) {
    // If the input is an integer, add the specified number of days to the current date
    today.setDate(today.getDate() + input);
    weekDay = weekDays[today.getDay()];
    day = today.getDate();
    hour = `${today.getHours()}:${today.getMinutes().toString().padStart(2, '0')}`;
  } else if (input instanceof Date) {
    // If the input is a Date object, extract the day and weekday information from it
    weekDay = weekDays[input.getDay()];
    day = input.getDate();
    hour = `${input.getHours()}:${input.getMinutes().toString().padStart(2, '0')}`;
  } else {
    // If the input is neither an integer nor a Date object, throw an error
    throw new Error('The input must be an integer or a Date object');
  }

  return { "dayName": `${weekDay} ${day}`, "dayNumber": day, "hour": hour };
}

/**
 * Sanitizes a string for DuckDB by replacing single quotes with two consecutive single quotes.
 *
 * @param {string} str - The string to be sanitized.
 * @return {string} The sanitized string.
 */
function sanitizeStringForDuckDB(str) {
  // Reemplazar comillas simples con dos comillas simples consecutivas
  const sanitizedStr = str.replace(/'/g, "''");
  return sanitizedStr;
}

/**
 * Converts a Unix epoch timestamp to an ISO 8601 formatted date string.
 *
 * @param {number} unixEpoch - The Unix epoch timestamp to convert.
 * @return {string} The ISO 8601 formatted date string.
 */
function convertUnixEpochToISO8601(unixEpoch) {
  const date = new Date(Number(unixEpoch));
  return date.toISOString();
}


module.exports = {
  convertISOToDuckDBTimestamp,
  isValidISODate8601,
  getCurrentDateTimestampFormat,
  getFutureDateTimestampFormat,
  getDateShortName,
  sanitizeStringForDuckDB,
  convertUnixEpochToISO8601
};