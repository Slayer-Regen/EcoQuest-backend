import pool from './index';
import { v4 as uuidv4 } from 'uuid';

async function seedDatabase() {
    const client = await pool.connect();

    try {
        console.log('Starting database seeding...');

        await client.query('BEGIN');

        // Seed emission factors
        console.log('Seeding emission factors...');
        const emissionFactors = [
            // Commute
            { category: 'commute', subcategory: 'car', factor: 0.192, unit: 'km', country_code: 'GLOBAL', source: 'DEFRA 2023' },
            { category: 'commute', subcategory: 'bus', factor: 0.05, unit: 'km', country_code: 'GLOBAL', source: 'DEFRA 2023' },
            { category: 'commute', subcategory: 'train', factor: 0.041, unit: 'km', country_code: 'GLOBAL', source: 'DEFRA 2023' },
            { category: 'commute', subcategory: 'bike', factor: 0, unit: 'km', country_code: 'GLOBAL', source: 'Zero emissions' },
            { category: 'commute', subcategory: 'walk', factor: 0, unit: 'km', country_code: 'GLOBAL', source: 'Zero emissions' },
            { category: 'commute', subcategory: 'motorcycle', factor: 0.113, unit: 'km', country_code: 'GLOBAL', source: 'DEFRA 2023' },
            { category: 'commute', subcategory: 'electric_car', factor: 0.053, unit: 'km', country_code: 'GLOBAL', source: 'DEFRA 2023' },

            // Electricity (varies by country)
            { category: 'electricity', subcategory: 'grid', factor: 0.5, unit: 'kwh', country_code: 'US', source: 'EPA 2023' },
            { category: 'electricity', subcategory: 'grid', factor: 0.233, unit: 'kwh', country_code: 'GB', source: 'UK Gov 2023' },
            { category: 'electricity', subcategory: 'grid', factor: 0.709, unit: 'kwh', country_code: 'IN', source: 'CEA 2023' },

            // Flights
            { category: 'flight', subcategory: 'short_haul', factor: 0.255, unit: 'km', country_code: 'GLOBAL', source: 'DEFRA 2023' },
            { category: 'flight', subcategory: 'medium_haul', factor: 0.156, unit: 'km', country_code: 'GLOBAL', source: 'DEFRA 2023' },
            { category: 'flight', subcategory: 'long_haul', factor: 0.15, unit: 'km', country_code: 'GLOBAL', source: 'DEFRA 2023' },

            // Food (per kg)
            { category: 'food', subcategory: 'beef', factor: 27.0, unit: 'kg', country_code: 'GLOBAL', source: 'Poore & Nemecek 2018' },
            { category: 'food', subcategory: 'lamb', factor: 24.5, unit: 'kg', country_code: 'GLOBAL', source: 'Poore & Nemecek 2018' },
            { category: 'food', subcategory: 'pork', factor: 7.2, unit: 'kg', country_code: 'GLOBAL', source: 'Poore & Nemecek 2018' },
            { category: 'food', subcategory: 'chicken', factor: 6.1, unit: 'kg', country_code: 'GLOBAL', source: 'Poore & Nemecek 2018' },
            { category: 'food', subcategory: 'fish', factor: 5.1, unit: 'kg', country_code: 'GLOBAL', source: 'Poore & Nemecek 2018' },
            { category: 'food', subcategory: 'vegetables', factor: 0.4, unit: 'kg', country_code: 'GLOBAL', source: 'Poore & Nemecek 2018' },
        ];

        for (const factor of emissionFactors) {
            await client.query(
                `INSERT INTO emission_factors (category, subcategory, factor, unit, country_code, source)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (category, subcategory, country_code) DO NOTHING`,
                [factor.category, factor.subcategory, factor.factor, factor.unit, factor.country_code, factor.source]
            );
        }

        // Seed a demo user
        console.log('Seeding demo user...');
        const demoUserId = uuidv4();
        await client.query(
            `INSERT INTO users (id, email, display_name, oauth_provider, oauth_id, country_code)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (email) DO NOTHING`,
            [demoUserId, 'demo@carbonfootprint.app', 'Demo User', 'google', 'demo-oauth-id', 'US']
        );

        // Seed demo partner
        console.log('Seeding demo partner...');
        const demoPartnerId = uuidv4();
        const apiKey = `partner_${uuidv4().replace(/-/g, '')}`;
        const webhookSecret = `whsec_${uuidv4().replace(/-/g, '')}`;

        await client.query(
            `INSERT INTO partners (id, name, api_key, webhook_secret, reward_rate)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (api_key) DO NOTHING`,
            [demoPartnerId, 'EcoStore Demo', apiKey, webhookSecret, 1.5]
        );

        console.log('\n📝 Demo Partner Credentials:');
        console.log(`   API Key: ${apiKey}`);
        console.log(`   Webhook Secret: ${webhookSecret}\n`);

        await client.query('COMMIT');

        console.log('✅ Database seeded successfully');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Seeding failed:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

seedDatabase().catch(console.error);
