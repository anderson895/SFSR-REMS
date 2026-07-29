/**
 * The condominium inventory St. Francis Square Realty sells.
 *
 * Kept separate from the scripts that write it because two different callers
 * need it — the Admin SDK migration and the client-SDK seeder — and they attach
 * their own server timestamps. Defining the inventory twice would let the two
 * drift apart.
 *
 * Structured as a list of projects so that adding the next tower is a data
 * edit and nothing more. To add one:
 *
 *   1. Put its renders and floor plans in a folder at the repo root.
 *   2. npm run upload:images -- <THAT_FOLDER>
 *   3. Append a ProjectSpec below, using the manifest keys the upload printed.
 *   4. npm run migrate:data
 *
 * Unit counts, floor areas, and floor ranges are transcribed from the approved
 * floor plan sheets. They are not illustrative — the totals a buyer sees in the
 * portal have to match the drawings filed with the project.
 */

import { imageUrl, type CropRegion } from './projectImages';

/** One sellable layout within a project. */
interface UnitTypeSpec {
  /** Short label used by the portal's type filter, e.g. "Studio", "2BR". */
  type: string;
  floorAreaSqm: number;
  /** Total number of this layout in the building, per the floor plan sheet. */
  totalUnits: number;
  /** Inclusive floor range this layout occupies. */
  lowestFloor: number;
  highestFloor: number;
  /** Price on the lowest floor; the floor premium is added on top. */
  basePrice: number;
  description: string;
  /** Manifest key from projectImages.json. */
  floorPlanImage: string;
}

interface ProjectSpec {
  name: string;
  location: string;
  /** Tower name stored on each unit and offered as the portal's tower filter. */
  building: string;
  /** Manifest key for the building render shown on unit cards. */
  heroImage: string;
  /**
   * Which part of that render to actually show.
   *
   * Required in practice: the source is a presentation board, and using it
   * whole puts body copy, a site plan and a keyplan into a 136px-tall card.
   * Pick a landscape region — `.unit-card-media` and `.unit-hero` are both
   * wide boxes with `object-fit: cover`, so a portrait crop of the tower gets
   * sliced through the middle and loses both the roofline and the podium.
   */
  heroCrop?: CropRegion;
  amenities: string[];
  /** Added to the base price once per floor, so higher floors cost more. */
  premiumPerFloor: number;
  /** Floors at or above this carry the promo. */
  promoFromFloor: number;
  promo: string;
  unitTypes: UnitTypeSpec[];
}

const LEGASPI_AMENITIES = [
  'Infinity Pool',
  'Fitness Gym',
  'Co-Working Space',
  'Sky Lounge',
  'Rooftop Garden',
  'High-Speed Elevators',
  '24/7 Security and CCTV Monitoring',
  'Fire Protection and Alarm System',
  'Backup Power System',
  'Rainwater Harvesting System',
];

const THE_LEGASPI_PLACE: ProjectSpec = {
  name: 'The Legaspi Place',
  location: 'Legaspi Village, Makati City',
  building: 'The Legaspi Place',
  heroImage: 'the-legaspi-place/the-legaspi-place',
  // Street-level band of the render on the 1024x1536 board: podium, signage,
  // and the Makati skyline at dusk. The full tower above it is portrait and
  // survives neither card nor hero framing.
  heroCrop: { x: 400, y: 360, w: 624, h: 300 },
  amenities: LEGASPI_AMENITIES,
  premiumPerFloor: 45_000,
  promoFromFloor: 30,
  promo: 'Zero percent interest for 24 months',
  unitTypes: [
    {
      type: 'Studio',
      floorAreaSqm: 24,
      totalUnits: 120,
      lowestFloor: 2,
      highestFloor: 35,
      basePrice: 6_200_000,
      description:
        'Efficient 24 sqm studio with a combined living and sleeping area, ' +
        'fitted kitchen, toilet and bath, and a built-in closet.',
      floorPlanImage: 'the-legaspi-place/studio-legaspi',
    },
    {
      type: '1BR',
      floorAreaSqm: 42,
      totalUnits: 100,
      lowestFloor: 2,
      highestFloor: 35,
      basePrice: 10_500_000,
      description:
        'One-bedroom unit with a separate 12 sqm bedroom, dining area, ' +
        'utility area, and a private balcony.',
      floorPlanImage: 'the-legaspi-place/1-br-legaspi',
    },
    {
      type: '2BR',
      floorAreaSqm: 62,
      totalUnits: 70,
      lowestFloor: 3,
      highestFloor: 35,
      basePrice: 15_400_000,
      description:
        'Two-bedroom unit with a master bedroom and en-suite toilet and bath, ' +
        'a second bedroom, common bath, and a balcony off the living area.',
      floorPlanImage: 'the-legaspi-place/2-br-legaspi',
    },
    {
      type: '3BR',
      floorAreaSqm: 88,
      totalUnits: 30,
      lowestFloor: 5,
      highestFloor: 35,
      basePrice: 22_000_000,
      description:
        'Three-bedroom corner unit with a 16 sqm master bedroom and en-suite ' +
        'bath, two additional bedrooms, a utility/maid’s room, storage, ' +
        'and a balcony.',
      floorPlanImage: 'the-legaspi-place/3-br-legaspi',
    },
  ],
};

/**
 * Every project in the catalogue.
 *
 * Two more towers are planned. Append them here once their floor plans and
 * renders have been uploaded — no other file needs to change.
 */
const PROJECTS: ProjectSpec[] = [THE_LEGASPI_PLACE];

/**
 * Stable document ids derived from names.
 *
 * Deterministic on purpose: re-seeding updates the same project and type
 * documents instead of creating duplicates, and `scripts/normalizeUnits.ts`
 * derives identical ids when converting existing data, so the two paths agree.
 */
export const projectId = (name: string) => slug(name);
export const unitTypeId = (project: string, type: string) =>
  `${slug(project)}--${slug(type)}`;

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export interface SeedProject {
  id: string;
  name: string;
  location: string;
  building: string;
  amenities: string[];
  images: string[];
  description: string;
}

export interface SeedUnitType {
  id: string;
  projectId: string;
  projectName: string;
  type: string;
  floorAreaSqm: number;
  floorPlanUrl: string;
  images: string[];
  description: string;
  promo: string;
  startingPrice: number;
  endingPrice: number;
  totalCount: number;
  lowestFloor: number;
  highestFloor: number;
  sortOrder: number;
}

/**
 * Only what actually varies from unit to unit.
 *
 * `projectName` and `type` are the two deliberate copies: the listing filters
 * and labels on them, and duplicating two short strings is cheaper than two
 * extra document reads per unit.
 */
export interface SeedUnit {
  projectId: string;
  typeId: string;
  projectName: string;
  type: string;
  unitNo: string;
  floor: number;
  price: number;
  status: string;
  heldBy: string | null;
}

export interface SeedCatalogue {
  projects: SeedProject[];
  unitTypes: SeedUnitType[];
  units: SeedUnit[];
}

/**
 * Spreads a layout's total unit count across the floors it occupies.
 *
 * The floor plan sheets give a total per layout (120 studios) and a floor range
 * (2nd to 35th) but not a per-floor breakdown, and 120 does not divide evenly
 * into 34 floors. The remainder is dealt to the lowest floors, which is how a
 * real stacking plan works: the tighter layouts cluster low and thin out as the
 * premium floors give more space to the larger units.
 *
 * The counts always sum to exactly `totalUnits`, so the seeded inventory
 * matches the drawings rather than approximating them.
 */
function unitsPerFloor(spec: UnitTypeSpec): Map<number, number> {
  const floorCount = spec.highestFloor - spec.lowestFloor + 1;
  const base = Math.floor(spec.totalUnits / floorCount);
  const remainder = spec.totalUnits % floorCount;

  const counts = new Map<number, number>();
  for (let i = 0; i < floorCount; i++) {
    counts.set(spec.lowestFloor + i, base + (i < remainder ? 1 : 0));
  }
  return counts;
}

/**
 * Builds the catalogue in its normalised form.
 *
 * Project-wide facts (amenities, location, the building render) are emitted
 * once as a project; per-layout facts (floor area, floor plan, description) are
 * emitted once as a unit type. Only the things that genuinely differ — unit
 * number, floor, price, status — are written per unit.
 *
 * Timestamps are added by the caller.
 */
export function buildSeedCatalogue(): SeedCatalogue {
  const projects: SeedProject[] = [];
  const unitTypes: SeedUnitType[] = [];
  const units: SeedUnit[] = [];

  for (const project of PROJECTS) {
    const hero = imageUrl(project.heroImage, project.heroCrop);
    const pid = projectId(project.name);

    projects.push({
      id: pid,
      name: project.name,
      location: project.location,
      building: project.building,
      amenities: project.amenities,
      images: [hero].filter(Boolean),
      description: '',
    });

    // Unit numbers run in one sequence per floor across all layouts, so a
    // buyer never sees two "1204"s on the same floor.
    const nextOnFloor = new Map<number, number>();

    const allocations = project.unitTypes.map((spec, index) => {
      const floorPlanUrl = imageUrl(spec.floorPlanImage);
      const tid = unitTypeId(project.name, spec.type);
      // The advertised range, computed from the spec rather than from the
      // generated units, so it stays correct no matter how many of those units
      // a page chooses to load.
      const lowestPrice = spec.basePrice + spec.lowestFloor * project.premiumPerFloor;
      const highestPrice =
        spec.basePrice + spec.highestFloor * project.premiumPerFloor;

      unitTypes.push({
        id: tid,
        projectId: pid,
        projectName: project.name,
        type: spec.type,
        floorAreaSqm: spec.floorAreaSqm,
        floorPlanUrl,
        // The render sells the address; the floor plan sells the layout.
        images: [hero, floorPlanUrl].filter(Boolean),
        description: spec.description,
        promo: project.promo,
        startingPrice: lowestPrice,
        endingPrice: highestPrice,
        totalCount: spec.totalUnits,
        lowestFloor: spec.lowestFloor,
        highestFloor: spec.highestFloor,
        sortOrder: index,
      });

      return { spec, tid, counts: unitsPerFloor(spec) };
    });

    const lowest = Math.min(...project.unitTypes.map((t) => t.lowestFloor));
    const highest = Math.max(...project.unitTypes.map((t) => t.highestFloor));

    for (let floor = lowest; floor <= highest; floor++) {
      for (const { spec, tid, counts } of allocations) {
        const count = counts.get(floor) ?? 0;

        for (let i = 0; i < count; i++) {
          const sequence = (nextOnFloor.get(floor) ?? 0) + 1;
          nextOnFloor.set(floor, sequence);

          units.push({
            projectId: pid,
            typeId: tid,
            projectName: project.name,
            type: spec.type,
            unitNo: `${floor}${String(sequence).padStart(2, '0')}`,
            floor,
            price: spec.basePrice + floor * project.premiumPerFloor,
            status: 'available',
            heldBy: null,
          });
        }
      }
    }
  }

  return { projects, unitTypes, units };
}
