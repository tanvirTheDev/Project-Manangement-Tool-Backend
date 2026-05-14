import { LeadIndustry } from '@prisma/client'

interface LeadForWA {
  contactPerson: string
  companyName: string
  assignedTo?: { name: string } | null
}

export const WHATSAPP_TEMPLATES: Record<LeadIndustry, (lead: LeadForWA) => string> = {
  GARMENTS: (lead) =>
    `আসসালামু আলাইকুম ${lead.contactPerson} ভাই,\n\nআমি DataFever Technology থেকে বলছি। আমরা গার্মেন্টস ইন্ডাস্ট্রির জন্য বিশেষভাবে তৈরি ERP Software তৈরি করি — Inventory, Production, HR, Payroll সহ সম্পূর্ণ সমাধান।\n\nআপনার ${lead.companyName}-এর জন্য একটি ফ্রি ডেমো দিতে পারি। কি আপনার জন্য সুবিধাজনক হবে?\n\nধন্যবাদ\n${lead.assignedTo?.name ?? 'DataFever Technology'}`,

  SCHOOL: (lead) =>
    `আসসালামু আলাইকুম ${lead.contactPerson} স্যার/ম্যাডাম,\n\nআমি DataFever Technology থেকে বলছি। আমরা স্কুল ও কলেজের জন্য সম্পূর্ণ Management Software তৈরি করি — Student Records, Fee Collection, Attendance, Result, Staff Management সহ।\n\n${lead.companyName}-এর জন্য একটি ফ্রি ডেমো দেখাতে পারি। কখন সময় হবে?\n\nধন্যবাদ\n${lead.assignedTo?.name ?? 'DataFever Technology'}`,

  PHARMACY: (lead) =>
    `আসসালামু আলাইকুম ${lead.contactPerson} ভাই,\n\nআমি DataFever Technology থেকে বলছি। আমরা ফার্মেসি ও ড্রাগ হাউসের জন্য বিশেষ POS ও Inventory Management Software তৈরি করি।\n\n${lead.companyName}-এর জন্য একটি ফ্রি ডেমো দিতে পারি?\n\nধন্যবাদ\n${lead.assignedTo?.name ?? 'DataFever Technology'}`,

  HOSPITAL: (lead) =>
    `আসসালামু আলাইকুম ${lead.contactPerson} স্যার/ম্যাডাম,\n\nআমি DataFever Technology থেকে বলছি। আমরা হাসপাতাল ও ক্লিনিকের জন্য HMS (Hospital Management System) তৈরি করি — Patient Records, Billing, OPD/IPD, Pharmacy সহ।\n\n${lead.companyName}-এর জন্য ফ্রি ডেমো দিতে পারি?\n\nধন্যবাদ\n${lead.assignedTo?.name ?? 'DataFever Technology'}`,

  REAL_ESTATE: (lead) =>
    `আসসালামু আলাইকুম ${lead.contactPerson} ভাই,\n\nআমি DataFever Technology থেকে বলছি। আমরা রিয়েল এস্টেট কোম্পানির জন্য Property Management ও CRM Software তৈরি করি।\n\n${lead.companyName}-এর জন্য একটি ফ্রি ডেমো দিতে পারি?\n\nধন্যবাদ\n${lead.assignedTo?.name ?? 'DataFever Technology'}`,

  MANUFACTURING: (lead) =>
    `আসসালামু আলাইকুম ${lead.contactPerson} ভাই,\n\nআমি DataFever Technology থেকে বলছি। আমরা ম্যানুফ্যাকচারিং কোম্পানির জন্য ERP Software তৈরি করি — Production, Inventory, HR ও Payroll সহ।\n\n${lead.companyName}-এর জন্য একটি ফ্রি ডেমো দিতে পারি?\n\nধন্যবাদ\n${lead.assignedTo?.name ?? 'DataFever Technology'}`,

  RETAIL: (lead) =>
    `আসসালামু আলাইকুম ${lead.contactPerson} ভাই,\n\nআমি DataFever Technology থেকে বলছি। আমরা রিটেইল ব্যবসার জন্য POS ও Inventory Management Software তৈরি করি।\n\n${lead.companyName}-এর জন্য একটি ফ্রি ডেমো দিতে পারি?\n\nধন্যবাদ\n${lead.assignedTo?.name ?? 'DataFever Technology'}`,

  OTHER: (lead) =>
    `আসসালামু আলাইকুম ${lead.contactPerson} ভাই,\n\nআমি DataFever Technology থেকে বলছি। আমরা আপনার ব্যবসার জন্য কাস্টম ERP ও Management Software তৈরি করি।\n\nআপনার ${lead.companyName}-এর জন্য একটি ফ্রি ডেমো দিতে পারি?\n\nধন্যবাদ\n${lead.assignedTo?.name ?? 'DataFever Technology'}`,
}

export function buildWhatsappUrl(phone: string, message: string): string {
  const normalized = phone.startsWith('0') ? `88${phone}` : phone.replace(/^\+/, '')
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`
}
