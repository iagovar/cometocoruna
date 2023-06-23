/**
 * Converts an ISO-8601 formatted date string to a DuckDB compatible timestamp string.
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

module.exports = {
  convertISOToDuckDBTimestamp,
  isValidISODate8601,
  getCurrentDateTimestampFormat,
  getFutureDateTimestampFormat
};