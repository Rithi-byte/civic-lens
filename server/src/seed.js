import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import User from './models/User.js';
import Issue from './models/Issue.js';
import Notification from './models/Notification.js';

const PASSWORD = 'password123';

const USERS = [
  { name: 'Admin Officer', email: 'admin@civiclens.in', role: 'admin' },
  { name: 'Ravi Kumar (Roads)', email: 'roads@civiclens.in', role: 'authority', department: 'roads' },
  { name: 'Meena S (Water)', email: 'water@civiclens.in', role: 'authority', department: 'water' },
  { name: 'Arun P (Electricity)', email: 'electricity@civiclens.in', role: 'authority', department: 'electricity' },
  { name: 'Lakshmi R (Sanitation)', email: 'sanitation@civiclens.in', role: 'authority', department: 'sanitation' },
  { name: 'Karthik V (Drainage)', email: 'drainage@civiclens.in', role: 'authority', department: 'drainage' },
  { name: 'Priya Citizen', email: 'citizen@civiclens.in', role: 'citizen', area: 'Tambaram' },
  { name: 'Rahul Menon', email: 'rahul@civiclens.in', role: 'citizen', area: 'Velachery' },
  { name: 'Divya Raj', email: 'divya@civiclens.in', role: 'citizen', area: 'Anna Nagar' },
  { name: 'Suresh Babu', email: 'suresh@civiclens.in', role: 'citizen', area: 'Guindy' },
];

const AREAS = {
  Tambaram: [12.9249, 80.1275],
  Velachery: [12.9791, 80.2209],
  'Anna Nagar': [13.085, 80.2101],
  Guindy: [13.0067, 80.2206],
  'T. Nagar': [13.0418, 80.2341],
  Adyar: [13.0012, 80.2565],
  Potheri: [12.8231, 80.0442],
  Chromepet: [12.9516, 80.1462],
};

// [title, description, category, priority, status, area, landmark, daysAgo]
const ISSUES = [
  ['Large pothole near bus stop', 'A deep pothole has formed right in front of the bus stop. Two-wheelers are skidding every day and it fills with water when it rains.', 'roads', 'high', 'in_progress', 'Tambaram', 'Tambaram West bus stop, GST Road', 12],
  ['Streetlights not working for a week', 'The entire stretch of 6 streetlights is off after 7 PM. Women and elderly residents feel unsafe walking home.', 'electricity', 'high', 'acknowledged', 'Velachery', '100 Feet Road, near Phoenix Mall', 8],
  ['Garbage not collected for 5 days', 'The community bin is overflowing and waste is spilling onto the road. Stray dogs are tearing the bags and the smell is unbearable.', 'sanitation', 'critical', 'reported', 'Anna Nagar', '2nd Avenue, Block AE', 2],
  ['Drinking water supply contaminated', 'Tap water in our street has turned brownish and smells bad since Monday. Many households are depending on cans now.', 'water', 'critical', 'in_progress', 'Guindy', 'Race Course Road, Lane 3', 6],
  ['Overflowing drainage on main road', 'The sewage manhole is overflowing onto the main road causing a health hazard. Pedestrians have to walk through dirty water.', 'drainage', 'high', 'reported', 'T. Nagar', 'Usman Road, opposite Pothys', 1],
  ['Broken footpath tiles', 'Footpath tiles are broken and uneven for about 50 metres. Senior citizens have tripped here twice this month.', 'roads', 'medium', 'resolved', 'Adyar', 'LB Road, near Adyar signal', 20],
  ['Water pipeline leakage', 'A main pipeline is leaking continuously and thousands of litres of water are being wasted every day.', 'water', 'high', 'resolved', 'Chromepet', 'Radha Nagar main road', 15],
  ['Transformer making sparking noise', 'The transformer at the junction makes loud sparking noises at night. Residents fear it could catch fire.', 'electricity', 'critical', 'in_progress', 'Potheri', 'Near SRM University main gate', 4],
  ['Stagnant water breeding mosquitoes', 'Rain water has been stagnant in the empty plot for two weeks and mosquito breeding has increased a lot.', 'drainage', 'medium', 'acknowledged', 'Tambaram', 'Kamaraj Nagar, 4th cross street', 9],
  ['Illegal dumping of construction waste', 'Construction debris is being dumped on the roadside at night, narrowing the road and blocking the storm drain.', 'sanitation', 'medium', 'reported', 'Velachery', 'Taramani Link Road', 3],
  ['Speed breaker without markings', 'A newly laid speed breaker has no white markings or signboard. Several bikers have fallen here at night.', 'roads', 'high', 'resolved', 'Anna Nagar', '3rd Main Road, near Tower Park', 18],
  ['Low water pressure in apartments', 'Upper floors of our apartment get almost no water in the morning supply hours for the last 10 days.', 'water', 'low', 'acknowledged', 'Adyar', 'Gandhi Nagar, 1st Main Road', 7],
  ['Fallen electric wire on footpath', 'After yesterday\'s rain an electric cable is hanging low and touching the footpath. Very dangerous for children.', 'electricity', 'critical', 'resolved', 'Guindy', 'Alandur Road, near metro station', 11],
  ['Public toilet not maintained', 'The public toilet near the market has no water and has not been cleaned for days.', 'sanitation', 'medium', 'in_progress', 'T. Nagar', 'Ranganathan Street market', 5],
  ['Road caved in after rain', 'A portion of the road has caved in near the canal bridge. Heavy vehicles are still using it which is risky.', 'roads', 'critical', 'acknowledged', 'Chromepet', 'Canal bridge, Station Road', 3],
  ['Blocked storm water drain', 'Storm water drain is completely blocked with plastic waste. Street floods even in light rain.', 'drainage', 'high', 'resolved', 'Velachery', 'Vijaya Nagar, 2nd Street', 14],
  ['Stray cattle on highway', 'Cattle are regularly sitting in the middle of the service road causing accidents at night.', 'other', 'medium', 'reported', 'Potheri', 'GST Road service lane, Potheri', 2],
  ['Park lights and benches damaged', 'Most benches in the children\'s park are broken and the lights do not work, so nobody uses it after sunset.', 'other', 'low', 'rejected', 'Anna Nagar', 'Anna Nagar Tower Park', 16],
  ['Manhole cover missing', 'A manhole on the busy junction has no cover. Someone has placed a branch in it as a warning.', 'drainage', 'critical', 'in_progress', 'Guindy', 'Kathipara junction service road', 1],
  ['Irregular garbage pickup timing', 'Garbage trucks come at random times so residents miss them and end up dumping waste on the street.', 'sanitation', 'low', 'resolved', 'Tambaram', 'Selaiyur main road', 13],
];

const FLOW = ['reported', 'acknowledged', 'in_progress', 'resolved'];
const NOTES = {
  acknowledged: 'Complaint verified by field staff.',
  in_progress: 'Work order issued, crew assigned.',
  resolved: 'Work completed and verified on site.',
  rejected: 'Park is under private maintenance contract; forwarded to the contractor.',
};

const jitter = () => (Math.random() - 0.5) * 0.012;

export async function seed() {
  await Promise.all([User.deleteMany({}), Issue.deleteMany({}), Notification.deleteMany({})]);

  const users = [];
  for (const u of USERS) users.push(await User.create({ ...u, password: PASSWORD }));
  const citizens = users.filter((u) => u.role === 'citizen');
  const officerFor = (cat) => users.find((u) => u.department === cat) || users[0];
  const DAY = 86400000;

  for (const [i, [title, description, category, priority, status, area, address, daysAgo]] of ISSUES.entries()) {
    const reporter = citizens[i % citizens.length];
    const officer = officerFor(category);
    const created = new Date(Date.now() - daysAgo * DAY);
    const steps = status === 'rejected' ? ['reported', 'rejected'] : FLOW.slice(0, FLOW.indexOf(status) + 1);
    const history = steps.map((s, idx) => ({
      status: s,
      note: s === 'reported' ? 'Issue reported' : NOTES[s],
      by: s === 'reported' ? reporter._id : officer._id,
      at: new Date(created.getTime() + idx * Math.max(1, daysAgo / steps.length) * DAY * 0.8),
    }));
    const [lat, lng] = AREAS[area];
    const upvoters = citizens.filter(() => Math.random() > 0.4).map((c) => c._id);

    const issue = new Issue({
      title,
      description,
      category,
      priority,
      status,
      location: { address, area, lat: lat + jitter(), lng: lng + jitter() },
      reporter: reporter._id,
      assignedTo: status === 'reported' ? null : officer._id,
      upvotes: [...new Set([reporter._id, ...upvoters].map(String))],
      history,
      resolvedAt: status === 'resolved' ? history.at(-1).at : null,
      comments:
        status !== 'reported'
          ? [
              { user: citizens[(i + 1) % citizens.length]._id, text: 'Facing the same problem here. Please fix soon!' },
              { user: officer._id, text: NOTES[status] || 'We are looking into this.' },
            ]
          : [],
    });
    issue.createdAt = created;
    issue.updatedAt = history.at(-1).at;
    await issue.save({ timestamps: false });
  }

  console.log(`✔ Seeded ${users.length} users and ${ISSUES.length} issues (password for all: ${PASSWORD})`);
}

export async function seedIfEmpty() {
  if ((await User.estimatedDocumentCount()) === 0) await seed();
}

// `npm run seed` wipes and re-seeds the database in MONGO_URI
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (!process.env.MONGO_URI) {
    console.error('Set MONGO_URI in server/.env first');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);
  await seed();
  await mongoose.disconnect();
}
