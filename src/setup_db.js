import fs from 'fs';
import path from 'path';
import { pool } from './db.js';

async function run() {
    try {
        const schemaPath = path.join(process.cwd(), 'schema.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');

        console.log('Running schema.sql...');
        await pool.query(schemaSql);
        console.log('Schema setup completed successfully.');

        // Optional: Run seed.sql if it exists
        try {
            const seedPath = path.join(process.cwd(), 'seed.sql');
            if (fs.existsSync(seedPath)) {
                const seedSql = fs.readFileSync(seedPath, 'utf8');
                console.log('Running seed.sql...');
                await pool.query(seedSql);
                console.log('Seed completed.');
            }
        } catch (e) {
            console.log('Skipping seed.sql (not essential).');
        }

        process.exit(0);
    } catch (err) {
        console.error('Error setting up database:', err);
        process.exit(1);
    }
}

run();
