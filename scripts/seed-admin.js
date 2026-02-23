// Run: node scripts/seed-admin.js
// (from your project root after npm install)

import bcrypt from 'bcryptjs'

const PASSWORD = 'Admin@123456' // Change this!

const ADMINS = [
  { email: 'admin@wellbuild.com',  username: 'admin.wellbuild',  name: 'WELLBUILD Admin',   biz: 'wellbuild'  },
  { email: 'admin@tcchemical.com', username: 'admin.tcchemical', name: 'TC CHEMICAL Admin', biz: 'tcchemical' },
  { email: 'admin@wellprint.com',  username: 'admin.wellprint',  name: 'WELLPRINT Admin',   biz: 'wellprint'  },
]

async function main() {
  console.log(`\n🔐 Generating hash for: "${PASSWORD}"\n`)
  const hash = await bcrypt.hash(PASSWORD, 12)
  console.log('Hash:', hash)
  console.log('\n── Copy this SQL into Supabase SQL Editor ──\n')

  const sql = ADMINS.map(a =>
    `INSERT INTO users (email, username, full_name, password_hash, role, business_id) VALUES\n` +
    `('${a.email}', '${a.username}', '${a.name}', '${hash}', 'admin', '${a.biz}')\n` +
    `ON CONFLICT (username) DO UPDATE SET password_hash = '${hash}';`
  ).join('\n\n')

  console.log(sql)
  console.log('\n────────────────────────────────────────────\n')
  console.log('✅ Login credentials:')
  ADMINS.forEach(a => console.log(`   ${a.biz}: @${a.username} / ${PASSWORD}`))
  console.log('\n⚠️  Change default passwords after first login!\n')
}

main().catch(console.error)
