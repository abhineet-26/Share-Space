import assert from 'node:assert/strict';
import { deterministicParseDiscoveryQuery } from '../src/mocks/server';
import { Resource } from '../src/lib/types';

// Canonical seeded resources representing both live PostgreSQL records and mock models
const testCatalog: Resource[] = [
  {
    id: 'res_scope',
    organizationId: 'org_nit',
    ownerId: 'usr_ravi',
    ownerName: 'Ravi Kulkarni',
    department: 'Electrical Engineering',
    name: 'Keysight DSOX1204G Digital Oscilloscope',
    category: 'ELECTRONICS',
    illustrationType: 'oscilloscope',
    location: 'EE Bench 4',
    accessInstructions: 'Sign out at EE office',
    description: '4-channel 70 MHz digital storage oscilloscope with 200 MSa/s sampling and wave generator.',
    condition: 'EXCELLENT',
    status: 'PUBLISHED',
    requirements: [],
    supervision: 'NONE',
    accessories: ['10:1 Passive Probes (x4)', 'BNC to Alligator Cable'],
    usageRules: 'Return probes neatly coiled.',
    returnRules: 'Check channel 1 calibration before returning.',
    cancellationPolicy: '2 hour notice.',
    availability: [],
    policyIds: [],
  },
  {
    id: 'res_dmm',
    organizationId: 'org_nit',
    ownerId: 'usr_ravi',
    ownerName: 'Ravi Kulkarni',
    department: 'Electrical Engineering',
    name: 'Fluke 87V Industrial True-RMS Multimeter',
    category: 'ELECTRONICS',
    illustrationType: 'multimeter',
    location: 'EE Cabinet 2',
    accessInstructions: 'Available on EE Bench',
    description: 'Rugged True-RMS digital multimeter for voltage, current, continuity, and temperature measurement.',
    condition: 'GOOD',
    status: 'PUBLISHED',
    requirements: [],
    supervision: 'NONE',
    accessories: ['TL75 test leads', 'Type-K thermocouple'],
    usageRules: 'Max 1000V input.',
    returnRules: 'Switch off meter.',
    cancellationPolicy: 'None.',
    availability: [],
    policyIds: [],
  },
  {
    id: 'res_psu',
    organizationId: 'org_nit',
    ownerId: 'usr_ravi',
    ownerName: 'Ravi Kulkarni',
    department: 'Electrical Engineering',
    name: 'Rigol DP832 Triple Output DC Power Supply',
    category: 'ELECTRONICS',
    illustrationType: 'powersupply',
    location: 'EE Bench 3',
    accessInstructions: 'Available on EE Bench',
    description: 'Programmable triple-channel DC power supply with isolated outputs.',
    condition: 'GOOD',
    status: 'PUBLISHED',
    requirements: [],
    supervision: 'NONE',
    accessories: ['Banana-to-alligator leads'],
    usageRules: 'Do not short high current channels.',
    returnRules: 'Zero output before disconnect.',
    cancellationPolicy: 'None.',
    availability: [],
    policyIds: [],
  },
  {
    id: 'res_tripod',
    organizationId: 'org_nit',
    ownerId: 'usr_ravi',
    ownerName: 'Ravi Kulkarni',
    department: 'Media Studio',
    name: 'Manfrotto Carbon Fiber Video Tripod',
    category: 'MEDIA_COMPUTING',
    illustrationType: 'camera',
    location: 'Media Studio Storage A',
    accessInstructions: 'Collect from studio rack',
    description: 'Heavy-duty carbon fiber tripod with fluid video head for stable panning and interview framing.',
    condition: 'EXCELLENT',
    status: 'PUBLISHED',
    requirements: [],
    supervision: 'NONE',
    accessories: ['504HD Fluid Head', 'Quick-release plate', 'Padded carry bag'],
    usageRules: 'Lock legs securely.',
    returnRules: 'Collapse legs and pack into bag.',
    cancellationPolicy: '1 hour notice.',
    availability: [],
    policyIds: [],
  },
  {
    id: 'res_camera',
    organizationId: 'org_nit',
    ownerId: 'usr_ravi',
    ownerName: 'Ravi Kulkarni',
    department: 'Media Studio',
    name: 'Sony FX3 Cinema Camera Kit',
    category: 'MEDIA_COMPUTING',
    illustrationType: 'camera',
    location: 'Media Studio Storage A',
    accessInstructions: 'Collect from studio cage',
    description: 'Full-frame cinema camera for 4K video recording, studio interviews, and documentary production.',
    condition: 'EXCELLENT',
    status: 'PUBLISHED',
    requirements: [],
    supervision: 'STAFF_CONFIRMATION',
    accessories: ['24-70mm f/2.8 GM Lens', 'Audio handle', '2x V-mount batteries'],
    usageRules: 'Handle optics with care.',
    returnRules: 'Return in Pelican case.',
    cancellationPolicy: '2 hour notice.',
    availability: [],
    policyIds: [],
  },
  {
    id: 'res_3dprint',
    organizationId: 'org_nit',
    ownerId: 'usr_ravi',
    ownerName: 'Ravi Kulkarni',
    department: 'Makerspace',
    name: 'UltiMaker S5 Dual-Extrusion 3D Printer',
    category: 'MEDIA_COMPUTING',
    illustrationType: 'printer3d',
    location: 'Maker Lab Bay 2',
    accessInstructions: 'Sign in at desk',
    description: 'Professional dual extrusion FDM printer with heated bed for rapid prototyping of enclosures.',
    condition: 'GOOD',
    status: 'PUBLISHED',
    requirements: [],
    supervision: 'STAFF_CONFIRMATION',
    accessories: ['Glass Build Plate', 'Nozzle Cleaning Kit'],
    usageRules: 'Only approved PLA/PETG filament.',
    returnRules: 'Clean bed scraper.',
    cancellationPolicy: '1 hour notice.',
    availability: [],
    policyIds: [],
  },
  {
    id: 'res_room204',
    organizationId: 'org_nit',
    ownerId: 'usr_ravi',
    ownerName: 'Ravi Kulkarni',
    department: 'Academic Facilities',
    name: 'Room 204 — Hardware Project Lab',
    category: 'SPACE',
    illustrationType: 'room_project',
    location: 'Hardware Wing 2nd Floor',
    accessInstructions: 'Keycard access',
    description: 'Collaborative project space with ESD benches and magnetic whiteboards for team reviews.',
    condition: 'GOOD',
    status: 'PUBLISHED',
    requirements: [],
    supervision: 'NONE',
    accessories: ['Dry-erase whiteboards', 'ESD mats', 'Power strips'],
    usageRules: 'Erase whiteboards after session.',
    returnRules: 'Turn off lights and lock door.',
    cancellationPolicy: 'None.',
    availability: [],
    policyIds: [],
  },
  {
    id: 'res_meeting_b',
    organizationId: 'org_nit',
    ownerId: 'usr_ravi',
    ownerName: 'Ravi Kulkarni',
    department: 'Academic Facilities',
    name: 'Conference Room B',
    category: 'SPACE',
    illustrationType: 'room_meeting',
    location: 'Admin Block Room 102',
    accessInstructions: 'Check schedule display outside',
    description: 'Meeting room with 4K conference display, Logitech MeetUp camera, and hybrid meeting facilities.',
    condition: 'EXCELLENT',
    status: 'PUBLISHED',
    requirements: [],
    supervision: 'NONE',
    accessories: ['65-inch 4K Display', 'Logitech MeetUp camera', 'Conference phone'],
    usageRules: 'Max 12 persons.',
    returnRules: 'Log off conference PC.',
    cancellationPolicy: 'None.',
    availability: [],
    policyIds: [],
  },
];

console.log('--- RUNNING ASSISTED SEARCH RANKING TESTS ---');

// Test 1: Heavy duty tripod
{
  const res = deterministicParseDiscoveryQuery('heavy duty tripod', testCatalog);
  assert.equal(res.category, 'MEDIA_COMPUTING', 'Category should be MEDIA_COMPUTING');
  assert.ok(res.matches.length > 0, 'Should return matches');
  assert.equal(res.matches[0].resourceId, 'res_tripod', 'Tripod must be top ranked match');
  console.log('✓ Test 1 Passed: "heavy duty tripod" -> top match: res_tripod');
}

// Test 2: Video recording 4K camera
{
  const res = deterministicParseDiscoveryQuery('video recording 4K camera for interview', testCatalog);
  assert.equal(res.category, 'MEDIA_COMPUTING', 'Category should be MEDIA_COMPUTING');
  assert.ok(res.matches.length > 0, 'Should return matches');
  assert.equal(res.matches[0].resourceId, 'res_camera', 'Camera must be top ranked match');
  console.log('✓ Test 2 Passed: "video recording 4K camera" -> top match: res_camera');
}

// Test 3: Measure PWM voltage ringing
{
  const res = deterministicParseDiscoveryQuery('Measure PWM voltage ringing', testCatalog);
  assert.equal(res.category, 'ELECTRONICS', 'Category should be ELECTRONICS');
  assert.ok(res.matches.length >= 2, 'Should return oscilloscope and secondary instruments');
  assert.equal(res.matches[0].resourceId, 'res_scope', 'Oscilloscope must be ranked #1');
  assert.equal(res.matches[1].resourceId, 'res_dmm', 'Multimeter must be ranked #2');
  console.log('✓ Test 3 Passed: "Measure PWM voltage ringing" -> #1 res_scope, #2 res_dmm');
}

// Test 4: Quiet room for team review with whiteboard
{
  const res = deterministicParseDiscoveryQuery('quiet room for team review with whiteboard', testCatalog);
  assert.equal(res.category, 'SPACE', 'Category should be SPACE');
  assert.ok(res.matches.length >= 2, 'Should return room facilities');
  const matchedIds = res.matches.map((m) => m.resourceId);
  assert.ok(matchedIds.includes('res_room204'), 'Must match res_room204');
  assert.ok(matchedIds.includes('res_meeting_b'), 'Must match res_meeting_b');
  // Must NOT match camera or soldering iron false positives
  assert.ok(!matchedIds.includes('res_camera'), 'Must not match camera false positive');
  console.log('✓ Test 4 Passed: "quiet room for team review with whiteboard" -> matched spaces accurately');
}

// Test 5: 3D print enclosure prototype
{
  const res = deterministicParseDiscoveryQuery('3D print enclosure prototype', testCatalog);
  assert.equal(res.category, 'MEDIA_COMPUTING', 'Category should be MEDIA_COMPUTING');
  assert.ok(res.matches.length > 0, 'Should return matches');
  assert.equal(res.matches[0].resourceId, 'res_3dprint', '3D printer must be top match');
  console.log('✓ Test 5 Passed: "3D print enclosure prototype" -> top match: res_3dprint');
}

console.log('ALL ASSISTED SEARCH UNIT TESTS PASSED CLEANLY.');
