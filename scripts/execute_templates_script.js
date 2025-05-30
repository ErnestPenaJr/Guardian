// Script to execute the SQL template creation script
import fs from 'fs';
import path from 'path';
import { Connection, Request } from 'tedious';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

// Database configuration
const config = {
  server: process.env.DB_SERVER || 'localhost',
  authentication: {
    type: 'default',
    options: {
      userName: process.env.DB_USER,
      password: process.env.DB_PASSWORD
    }
  },
  options: {
    database: process.env.DB_NAME,
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true',
    port: parseInt(process.env.DB_PORT || '1433', 10),
    rowCollectionOnRequestCompletion: true,
    connectTimeout: 30000
  }
};

// Read the SQL script
const sqlFilePath = path.join(__dirname, 'add_standard_templates.sql');
const sqlScript = fs.readFileSync(sqlFilePath, 'utf8');

// Function to execute statements sequentially
function executeStatements(connection, statements, index) {
  if (index >= statements.length) {
    console.log('Script execution completed successfully.');
    connection.close();
    return;
  }
  
  const currentStatement = statements[index];
  console.log(`Executing statement ${index + 1} of ${statements.length}...`);
  
  const request = new Request(currentStatement, (err, rowCount) => {
    if (err) {
      console.error('Error executing statement:', err);
      console.error('Statement:', currentStatement);
      connection.close();
      process.exit(1);
    }
    
    console.log(`Statement ${index + 1} executed successfully.`);
    executeStatements(connection, statements, index + 1);
  });
  
  connection.execSql(request);
}

// Connect to the database and execute the script
const connection = new Connection(config);

connection.on('connect', (err) => {
  if (err) {
    console.error('Error connecting to database:', err);
    process.exit(1);
  }
  
  console.log('Connected to database. Executing script...');
  
  // Split the script into individual statements
  // This is a simple approach and might not work for all SQL scripts
  const statements = sqlScript
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter(line => !line.trim().startsWith('--')) // Remove comments
    .join('\n')
    .split(';')
    .filter(stmt => stmt.trim());
  
  executeStatements(connection, statements, 0);
});

connection.connect();
