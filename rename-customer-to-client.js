const fs = require('fs');
const path = require('path');
const glob = require('glob');

// You may need to install glob: npm install glob

const BASE_DIR = './src/app';

// Backup directory
const backupDir = `./src_backup_${new Date().toISOString().replace(/[:.]/g, '-')}`;

console.log('Creating backup...');
if (!fs.existsSync(backupDir)) {
    fs.cpSync('./src', backupDir, { recursive: true });
    console.log(`Backup created at: ${backupDir}`);
}

// Mapping of replacements
const replacements = [
    // Class and interface names
    { from: /\bCustomer\b/g, to: 'Client' },
    { from: /\bCustomers\b/g, to: 'Clients' },
    { from: /\bCUSTOMER\b/g, to: 'CLIENT' },
    { from: /\bCUSTOMERS\b/g, to: 'CLIENTS' },
    
    // Variable and property names
    { from: /\bcustomer\b/g, to: 'client' },
    { from: /\bcustomers\b/g, to: 'clients' },
    
    // Component names
    { from: /CustomersComponent/g, to: 'ClientsComponent' },
    { from: /CustomerComponent/g, to: 'ClientComponent' },
    { from: /NewcustomerComponent/g, to: 'NewclientComponent' },
    
    // Service names
    { from: /CustomerService/g, to: 'ClientService' },
    { from: /customerService/g, to: 'clientService' },
    
    // Method names
    { from: /selectCustomer/g, to: 'selectClient' },
    { from: /deleteCustomer/g, to: 'deleteClient' },
    { from: /createCustomer/g, to: 'createClient' },
    { from: /updateCustomer/g, to: 'updateClient' },
    { from: /newCustomer/g, to: 'newClient' },
    { from: /loadCustomers/g, to: 'loadClients' },
    { from: /searchCustomers/g, to: 'searchClients' },
    { from: /customerCreated/g, to: 'clientCreated' },
    { from: /onCustomerCreated/g, to: 'onClientCreated' },
    
    // State and observable names
    { from: /customersState/g, to: 'clientsState' },
    { from: /CustomerState/g, to: 'ClientState' },
    { from: /customer\$/g, to: 'client$' },
    { from: /customers\$/g, to: 'clients$' },
    
    // Path replacements
    { from: /\/customers/g, to: '/clients' },
    { from: /\/customer/g, to: '/client' },
    
    // File paths in imports
    { from: /interface\/customer/g, to: 'interface/client' },
    { from: /service\/customer\.service/g, to: 'service/client.service' },
    { from: /component\/customer\//g, to: 'component/client/' },
    
    // Property paths
    { from: /customer\.id/g, to: 'client.id' },
    { from: /customer\./g, to: 'client.' },
    
    // Form and template specific
    { from: /customer-form/g, to: 'client-form' },
    { from: /newcustomer/g, to: 'newclient' },
    
    // Stats specific
    { from: /totalCustomers/g, to: 'totalClients' },
    
    // ID fields
    { from: /customerId/g, to: 'clientId' },
    { from: /customer_id/g, to: 'client_id' },
];

// Function to rename files and directories
function renameFilesAndDirs() {
    console.log('\n=== Renaming files and directories ===\n');
    
    // Get all files and directories
    const items = glob.sync(`${BASE_DIR}/**/*customer*`, { nodir: false });
    
    // Sort by depth (deepest first) to avoid conflicts when renaming
    items.sort((a, b) => b.split('/').length - a.split('/').length);
    
    items.forEach(oldPath => {
        const newPath = oldPath.replace(/customer/g, 'client').replace(/Customer/g, 'Client');
        if (oldPath !== newPath) {
            try {
                fs.renameSync(oldPath, newPath);
                console.log(`Renamed: ${oldPath} -> ${newPath}`);
            } catch (err) {
                console.error(`Error renaming ${oldPath}: ${err.message}`);
            }
        }
    });
}

// Function to update file contents
function updateFileContents() {
    console.log('\n=== Updating file contents ===\n');
    
    // Get all TypeScript, HTML, CSS, and SCSS files
    const files = glob.sync(`${BASE_DIR}/**/*.{ts,html,css,scss}`, { nodir: true });
    
    files.forEach(filePath => {
        try {
            let content = fs.readFileSync(filePath, 'utf8');
            let hasChanges = false;
            
            // Apply all replacements
            replacements.forEach(({ from, to }) => {
                const newContent = content.replace(from, to);
                if (newContent !== content) {
                    hasChanges = true;
                    content = newContent;
                }
            });
            
            // Write back if changes were made
            if (hasChanges) {
                fs.writeFileSync(filePath, content, 'utf8');
                console.log(`Updated: ${filePath}`);
            }
        } catch (err) {
            console.error(`Error processing ${filePath}: ${err.message}`);
        }
    });
}

// Function to fix specific known issues
function fixSpecificIssues() {
    console.log('\n=== Fixing specific issues ===\n');
    
    // Fix routing modules
    const routingFiles = glob.sync(`${BASE_DIR}/**/*routing*.ts`);
    routingFiles.forEach(file => {
        try {
            let content = fs.readFileSync(file, 'utf8');
            content = content.replace(/path:\s*['"]customers['"]/g, "path: 'clients'");
            content = content.replace(/path:\s*['"]customer['"]/g, "path: 'client'");
            fs.writeFileSync(file, content, 'utf8');
            console.log(`Fixed routing in: ${file}`);
        } catch (err) {
            console.error(`Error fixing routing in ${file}: ${err.message}`);
        }
    });
    
    // Fix menu files
    const menuFiles = glob.sync(`${BASE_DIR}/**/menu*.ts`);
    menuFiles.forEach(file => {
        try {
            let content = fs.readFileSync(file, 'utf8');
            content = content.replace(/link:\s*['"]\/customers['"]/g, "link: '/clients'");
            content = content.replace(/link:\s*['"]\/customer['"]/g, "link: '/client'");
            fs.writeFileSync(file, content, 'utf8');
            console.log(`Fixed menu in: ${file}`);
        } catch (err) {
            console.error(`Error fixing menu in ${file}: ${err.message}`);
        }
    });
}

// Main execution
console.log('=== Starting customer to client migration ===');

try {
    // Step 1: Rename files and directories
    renameFilesAndDirs();
    
    // Step 2: Update file contents
    updateFileContents();
    
    // Step 3: Fix specific issues
    fixSpecificIssues();
    
    console.log('\n=== Migration complete! ===\n');
    console.log('Next steps:');
    console.log('1. Run "npm install" if needed');
    console.log('2. Run "npm run build" to check for compilation errors');
    console.log('3. Run "npm test" to verify tests');
    console.log('4. Review changes with "git diff"');
    console.log('5. If everything looks good, commit the changes');
    console.log(`\nBackup created at: ${backupDir}`);
} catch (err) {
    console.error('\nError during migration:', err);
    console.log(`\nYou can restore from backup at: ${backupDir}`);
}