const ftpClient = require('ftp');
const fs = require('fs');

/**
 * Uploads a file to a remote server using FTP.
 * Also handles deleting obsolete contents in remote server.
 *
 * @param {string} localFilePath - The path of the local file to be uploaded.
 * @param {string} remoteFilePath - The path where the file will be uploaded on the remote server.
 * @param {string} localFolderPath - The path of the local folder containing the file to be uploaded.
 * @param {string} remoteFolderPath - The path of the remote folder where the file will be uploaded.
 * @param {object} ftpConfig - The FTP configuration object containing the connection details.
 * @return {Promise<void>} A promise that resolves when the file has been uploaded successfully.
 */
async function uploadFileByFTP(localFilePath, remoteFilePath, localFolderPath, remoteFolderPath, ftpConfig) {
    const client = new ftpClient();
  
    try {
      console.log('Connecting to FTP server...');
      // Connect to the FTP server
      await new Promise((resolve, reject) => {
        client.on('ready', resolve);
        client.on('error', reject);
        client.connect(ftpConfig);
      });
      console.log('Connected to FTP server.');
  
      console.log(`Uploading ${localFilePath} file to ${remoteFilePath} in remote server...`);
      // Upload the local template file to the remote server
      await new Promise((resolve, reject) => {
        client.put(localFilePath, remoteFilePath, (error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });
      console.log('File uploaded successfully via FTP.');
  
      console.log(`Deleting contents of ${remoteFolderPath}img on remote server...`);
      // Delete the contents of the remote "img" directory
      try {
        await new Promise((resolve, reject) => {
          client.rmdir(`${remoteFolderPath}img`, true, (error) => {
            if (error) {
              reject(error);
            } else {
              resolve();
            }
          });
        });
        console.log('Contents of remote "img" directory deleted successfully.');
      } catch (error) {
        // Handle the error when the directory doesn't exist
        if (error.code === 550) {
          console.log(`Directory "${remoteFolderPath}img" does not exist. Skipping removal.`);
        } else {
          throw error;
        }
      }
  
      // Creating the "img" directory in the remote server if it doesn't exist
      try {
        await new Promise((resolve, reject) => {
          client.mkdir(`${remoteFolderPath}img`, (error) => {
            if (error) {
              reject(error);
            } else {
              resolve();
            }
          });
        })
      } catch (error) {
        console.error('Error creating "img" directory:', error);
      }
  
      // Get the list of files in the local "img" directory
      const files = fs.readdirSync(localFolderPath + '/img');
  
      // Upload each file to the remote "img" directory
      for (const file of files) {
        await new Promise((resolve, reject) => {
          client.put(localFolderPath + '/img/' + file, remoteFolderPath + '/img/' + file, (error) => {
            if (error) {
              reject(error);
            } else {
              resolve();
            }
          });
        })
      }
  
      console.log('Files uploaded successfully via FTP.');
  
    } catch (error) {
      console.error('Error uploading file via FTP:', error);
      throw error;
    } finally {
      console.log('Closing FTP connection...');
      // Close the FTP connection
      client.end();
      console.log('FTP connection closed.');
    }
}

module.exports = uploadFileByFTP;