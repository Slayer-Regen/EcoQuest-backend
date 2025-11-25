import { query } from '../db';
import { logger } from '../utils/logger';

interface EmissionFactor {
    category: string;
    sub_category: string;
    factor: number;
    unit: string;
    region?: string;
}

export class CarbonCalculator {
    private static factors: Map<string, EmissionFactor> = new Map();

    /**
     * Initialize the calculator by loading emission factors from the database
     */
    static async initialize() {
        try {
            const result = await query('SELECT * FROM emission_factors');

            result.rows.forEach((row: any) => {
                const key = this.getFactorKey(row.category, row.sub_category, row.region);
                this.factors.set(key, {
                    category: row.category,
                    sub_category: row.sub_category,
                    factor: parseFloat(row.factor),
                    unit: row.unit,
                    region: row.region,
                });
            });

            logger.info(`Loaded ${this.factors.size} emission factors`);
        } catch (error) {
            logger.error('Failed to load emission factors:', error);
            throw error;
        }
    }

    private static getFactorKey(category: string, subCategory: string, region: string = 'global'): string {
        return `${category}:${subCategory}:${region}`.toLowerCase();
    }

    /**
     * Calculate carbon footprint for a commute activity
     */
    static async   calculateCommute(
        mode: string,
        distanceKm: number,
        passengers: number = 1
    ): Promise<number> {
        // Try to find specific factor, fallback to global
        let factor = this.factors.get(this.getFactorKey('transport', mode, 'global'));

        if (!factor) {
            // Try to fetch from DB if not in cache (fallback)
            await this.initialize();
            factor = this.factors.get(this.getFactorKey('transport', mode, 'global'));
        }

        if (!factor) {
            logger.warn(`No emission factor found for transport mode: ${mode}`);
            // Default fallback (average car)
            return 0.17 * distanceKm;
        }

        // Calculate total emissions
        const totalEmissions = factor.factor * distanceKm;

        // For shared transport (carpool), divide by passengers
        // For public transport (bus, train), the factor is usually per passenger-km already
        if (['car', 'motorcycle', 'electric_car'].includes(mode.toLowerCase())) {
            return totalEmissions / Math.max(1, passengers);
        }

        return totalEmissions;
    }

    /**
     * Calculate carbon footprint for electricity usage
     */
    static async calculateElectricity(
        kwh: number,
        countryCode: string = 'US'
    ): Promise<number> {
        let factor = this.factors.get(this.getFactorKey('energy', 'electricity', countryCode));

        if (!factor) {
            // Fallback to global average or US default
            factor = this.factors.get(this.getFactorKey('energy', 'electricity', 'global')) ||
                this.factors.get(this.getFactorKey('energy', 'electricity', 'US'));
        }

        if (!factor) {
            logger.warn(`No emission factor found for electricity in: ${countryCode}`);
            return 0.4 * kwh; // Default fallback
        }

        return factor.factor * kwh;
    }

    /**
     * Calculate carbon footprint for a flight
     */
    static async calculateFlight(
        distanceKm: number,
        cabinClass: 'economy' | 'business' | 'first' = 'economy'
    ): Promise<number> {
        // Determine haul type
        let haulType = 'short_haul'; // < 1500 km
        if (distanceKm > 3500) {
            haulType = 'long_haul';
        } else if (distanceKm >= 1500) {
            haulType = 'medium_haul';
        }

        let factor = this.factors.get(this.getFactorKey('transport', `flight_${haulType}`, 'global'));

        if (!factor) {
            logger.warn(`No emission factor found for flight type: ${haulType}`);
            return 0.15 * distanceKm; // Default fallback
        }

        let emissions = factor.factor * distanceKm;

        // Apply cabin class multiplier
        // Business/First class take up more space, hence higher share of emissions
        if (cabinClass === 'business') emissions *= 2.9;
        if (cabinClass === 'first') emissions *= 4.0;

        // Radiative forcing multiplier (contrails, etc.) - usually 1.9x
        // Assuming the base factor might not include it, but let's be conservative for now
        // or assume the factor provided includes it. Let's add a small buffer.
        return emissions;
    }

    /**
     * Calculate carbon footprint for food
     */
    static async calculateFood(
        type: string,
        weightKg: number
    ): Promise<number> {
        const factor = this.factors.get(this.getFactorKey('food', type, 'global'));

        if (!factor) {
            logger.warn(`No emission factor found for food type: ${type}`);
            return 2.5 * weightKg; // Default fallback (average meal)
        }

        return factor.factor * weightKg;
    }
}
