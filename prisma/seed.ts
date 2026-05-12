import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const users = [
  { email: 'admin@datafever.com',         password: 'Admin@1234',   name: 'DataFever Admin',  role: 'ADMIN'   },
  { email: 'jlabtanvir@gmail.com',         password: 'Manager@1234', name: 'Tanvir',           role: 'MANAGER' },
  { email: 'workjlab.jewel@gmail.com',     password: 'Manager@1234', name: 'Jewel',            role: 'MANAGER' },
  { email: 'ah18bd@gmail.com',             password: 'Member@1234',  name: 'AH Member',        role: 'MEMBER'  },
  { email: 'jlab.tamal.paul@gmail.com',    password: 'Member@1234',  name: 'Tamal Paul',       role: 'MEMBER'  },
] as const

async function main() {
  for (const u of users) {
    const existing = await prisma.user.findUnique({ where: { email: u.email } })
    if (existing) {
      console.log(`Already exists: ${u.email}`)
      continue
    }
    const passwordHash = await bcrypt.hash(u.password, 10)
    await prisma.user.create({
      data: { email: u.email, passwordHash, name: u.name, role: u.role, isActive: true },
    })
    console.log(`Created [${u.role}] ${u.email} | password: ${u.password}`)
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
