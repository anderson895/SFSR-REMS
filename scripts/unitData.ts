/**
 * Demo condominium inventory.
 *
 * Kept separate from the scripts that write it because two different callers
 * need it — the Admin SDK migration and the client-SDK seeder — and they attach
 * their own server timestamps. Defining the inventory twice would let the two
 * drift apart.
 */

const AMENITIES = [
  'Swimming Pool',
  'Fitness Gym',
  'Function Room',
  'Playground',
  'Sky Garden',
  '24/7 Security',
  'Basement Parking',
  'Convenience Store',
];

interface UnitTemplate {
  type: string;
  floorAreaSqm: number;
  basePrice: number;
  description: string;
}

const TEMPLATES: UnitTemplate[] = [
  {
    type: 'Studio',
    floorAreaSqm: 24,
    basePrice: 3_450_000,
    description:
      'Efficient studio layout with a fitted kitchen, ideal for young professionals.',
  },
  {
    type: '1BR',
    floorAreaSqm: 36,
    basePrice: 5_200_000,
    description:
      'One-bedroom unit with a separate sleeping area and a private balcony.',
  },
  {
    type: '2BR',
    floorAreaSqm: 58,
    basePrice: 8_150_000,
    description:
      'Two-bedroom corner unit with a spacious living area and city views.',
  },
];

const TOWERS = [
  { building: 'St. Francis Tower A', floors: [5, 8, 12, 15] },
  { building: 'St. Francis Tower B', floors: [6, 9, 14] },
];

export interface SeedUnit {
  projectName: string;
  building: string;
  unitNo: string;
  floor: number;
  type: string;
  floorAreaSqm: number;
  price: number;
  status: string;
  amenities: string[];
  images: string[];
  floorPlanUrl: string;
  description: string;
  promo: string;
  heldBy: string | null;
}

/** Builds the inventory. Timestamps are added by the caller. */
export function buildSeedUnits(): SeedUnit[] {
  const units: SeedUnit[] = [];

  for (const tower of TOWERS) {
    for (const floor of tower.floors) {
      // Three unit types per floor gives the portal's filters a realistic
      // spread of prices and sizes to work with.
      TEMPLATES.forEach((template, index) => {
        units.push({
          projectName: 'St. Francis Square Residences',
          building: tower.building,
          unitNo: `${floor}${String(index + 1).padStart(2, '0')}`,
          floor,
          type: template.type,
          floorAreaSqm: template.floorAreaSqm,
          // Higher floors carry a premium, as in the real inventory.
          price: template.basePrice + floor * 35_000,
          status: 'available',
          amenities: AMENITIES,
          images: [],
          floorPlanUrl: '',
          description: template.description,
          promo: floor >= 14 ? 'Zero percent interest for 24 months' : '',
          heldBy: null,
        });
      });
    }
  }

  return units;
}
