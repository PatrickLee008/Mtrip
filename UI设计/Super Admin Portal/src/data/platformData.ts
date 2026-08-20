// ─── Types ──────────────────────────────────────────────────────────────────
export type MerchantCategory = 'hotel' | 'resort' | 'boutique' | 'guesthouse' | 'serviced_apartment' | 'hostel'
export type MerchantStatus = 'active' | 'suspended' | 'inactive'
export type VerifStatus = 'approved' | 'pending' | 'rejected' | 'resubmission'
export type CommissionPlan = 'standard' | 'premium' | 'vip' | 'custom'
export type BookingStatus = 'confirmed' | 'completed' | 'cancelled' | 'no_show' | 'checked_in'
export type RefundStatus = 'none' | 'requested' | 'approved' | 'rejected' | 'processed'
export type SettlementStatus = 'settled' | 'pending' | 'processing' | 'overdue'

export interface Merchant {
  id: string
  merchantName: string
  businessName: string
  ownerName: string
  category: MerchantCategory
  city: string
  country: string
  phone: string
  email: string
  stars: number
  rooms: number
  status: MerchantStatus
  verificationStatus: VerifStatus
  commissionPlan: CommissionPlan
  commissionRate: number
  joinDate: string
  lastLogin: string
  monthlyRevenue: number
  monthlyBookings: number
  isVip: boolean
  businessRegNo: string
  bankName: string
  bankAccount: string
}

export interface VerifApplication {
  applicationId: string
  merchantId: string
  merchantName: string
  businessName: string
  businessRegNo: string
  ownerName: string
  ownerIdNo: string
  phone: string
  email: string
  city: string
  category: MerchantCategory
  submittedDate: string
  status: VerifStatus
  reviewer: string
  notes: string
  documents: { name: string; type: string; status: 'verified' | 'pending' | 'rejected' }[]
  timeline: { date: string; action: string; by: string }[]
}

export interface Booking {
  id: string
  merchantId: string
  merchantName: string
  hotelName: string
  guestName: string
  guestPhone: string
  guestEmail: string
  checkIn: string
  checkOut: string
  nights: number
  roomType: string
  amount: number
  commission: number
  bookingStatus: BookingStatus
  refundStatus: RefundStatus
  refundAmount?: number
  settlementStatus: SettlementStatus
  channel: string
  createdAt: string
  promotionCode?: string
}

export interface Campaign {
  id: string
  name: string
  type: 'flash_sale' | 'loyalty' | 'seasonal' | 'partnership' | 'referral' | 'long_stay_deal'
  status: 'active' | 'paused' | 'ended' | 'scheduled' | 'draft'
  startDate: string
  endDate: string
  budget: number
  spent: number
  goal: string
  merchantCount: number
  totalClaims: number
  conversions: number
  revenue: number
  createdBy: string
  linkedVouchers: number
  linkedCodes: number
  owner: 'platform' | 'merchant'
  merchantOwner?: string
}

export interface Voucher {
  id: string
  name: string
  campaignId: string | null
  voucherType: 'fixed' | 'percentage' | 'free_night' | 'upgrade'
  value: number
  valueDisplay: string
  status: 'active' | 'paused' | 'expired' | 'scheduled' | 'draft'
  startDate: string
  endDate: string
  quantity: number
  claimed: number
  redeemed: number
  minSpend: number
  perUserLimit: number
  totalRedemptionLimit: number
  merchantScope: 'all' | 'selected'
  merchantCount: number
  createdBy: string
  createdAt: string
}

export interface PromoCode {
  id: string
  code: string
  name: string
  campaignId: string | null
  discountType: 'percentage' | 'fixed' | 'free_night' | 'cashback'
  discountValue: number
  discountDisplay: string
  status: 'active' | 'paused' | 'expired' | 'scheduled' | 'draft'
  startDate: string
  endDate: string
  usageLimit: number
  usageCount: number
  perUserLimit: number
  minSpend: number
  stackable: boolean
  merchantScope: 'all' | 'selected'
  merchantCount: number
  createdBy: string
  createdAt: string
}

export interface Affiliate {
  id: string
  name: string
  handle: string
  type: 'influencer' | 'blogger' | 'kol' | 'ota_partner' | 'corporate'
  platform: string
  followers: number
  status: 'active' | 'pending' | 'suspended' | 'rejected'
  commissionRate: number
  totalEarnings: number
  withdrawable: number
  totalReferrals: number
  conversions: number
  joinDate: string
  lastActivity: string
  fraudScore: number
}

// ─── Merchants (30) ────────────────────────────────────────────────────────
export const merchants: Merchant[] = [
  { id: 'MCH-0001', merchantName: 'The Peninsula Beijing', businessName: 'Peninsula Hotels (Beijing) Co., Ltd.', ownerName: 'James Liu', category: 'hotel', city: 'Beijing', country: 'CN', phone: '+86 10-8516-2888', email: 'revenue@peninsula-bj.com', stars: 5, rooms: 525, status: 'active', verificationStatus: 'approved', commissionPlan: 'vip', commissionRate: 6, joinDate: '2019-03-12', lastLogin: '2024-12-15 09:22', monthlyRevenue: 2800000, monthlyBookings: 412, isVip: true, businessRegNo: '91110000100014871B', bankName: 'ICBC Beijing Branch', bankAccount: '****4821' },
  { id: 'MCH-0002', merchantName: 'Grand Hyatt Shanghai', businessName: 'Hyatt Hotels (Shanghai) Co., Ltd.', ownerName: 'Sarah Chen', category: 'hotel', city: 'Shanghai', country: 'CN', phone: '+86 21-1234-1234', email: 'ops@grandhyatt-sh.com', stars: 5, rooms: 631, status: 'active', verificationStatus: 'approved', commissionPlan: 'vip', commissionRate: 6, joinDate: '2018-06-20', lastLogin: '2024-12-15 11:04', monthlyRevenue: 2400000, monthlyBookings: 568, isVip: true, businessRegNo: '9131000070218621XU', bankName: 'Bank of China Shanghai', bankAccount: '****7743' },
  { id: 'MCH-0003', merchantName: 'Marriott Shenzhen', businessName: 'Marriott International (Shenzhen) Ltd.', ownerName: 'Kevin Wang', category: 'hotel', city: 'Shenzhen', country: 'CN', phone: '+86 755-8888-9999', email: 'gm@marriott-sz.com', stars: 5, rooms: 466, status: 'active', verificationStatus: 'approved', commissionPlan: 'premium', commissionRate: 8, joinDate: '2020-01-08', lastLogin: '2024-12-14 16:30', monthlyRevenue: 1900000, monthlyBookings: 384, isVip: false, businessRegNo: '91440300MA5ETQ422L', bankName: 'CITIC Bank Shenzhen', bankAccount: '****2280' },
  { id: 'MCH-0004', merchantName: 'Hilton Chengdu', businessName: 'Hilton Hotels (Chengdu) Co., Ltd.', ownerName: 'Emily Zhang', category: 'hotel', city: 'Chengdu', country: 'CN', phone: '+86 28-8470-8888', email: 'hilton@chengdu-hilton.com', stars: 4, rooms: 347, status: 'active', verificationStatus: 'approved', commissionPlan: 'premium', commissionRate: 8, joinDate: '2021-04-15', lastLogin: '2024-12-15 08:15', monthlyRevenue: 1300000, monthlyBookings: 298, isVip: false, businessRegNo: '91510100MA62HT3J4X', bankName: 'CCB Chengdu Branch', bankAccount: '****9912' },
  { id: 'MCH-0005', merchantName: 'Sofitel Guangzhou', businessName: 'Accor Hotels (Guangzhou) Co., Ltd.', ownerName: 'Michael Zhao', category: 'hotel', city: 'Guangzhou', country: 'CN', phone: '+86 20-3888-9888', email: 'sofitel@accor-gz.com', stars: 5, rooms: 420, status: 'active', verificationStatus: 'approved', commissionPlan: 'premium', commissionRate: 8, joinDate: '2019-11-22', lastLogin: '2024-12-13 14:20', monthlyRevenue: 1500000, monthlyBookings: 320, isVip: false, businessRegNo: '91440101MA5D2L7Y1H', bankName: 'ABC Guangzhou Branch', bankAccount: '****5531' },
  { id: 'MCH-0006', merchantName: 'W Hotel Chengdu', businessName: 'W Hospitality (Chengdu) Ltd.', ownerName: 'Grace Li', category: 'boutique', city: 'Chengdu', country: 'CN', phone: '+86 28-6666-8888', email: 'w@whatevercdu.com', stars: 5, rooms: 289, status: 'active', verificationStatus: 'approved', commissionPlan: 'standard', commissionRate: 10, joinDate: '2022-08-01', lastLogin: '2024-12-15 10:45', monthlyRevenue: 1100000, monthlyBookings: 187, isVip: false, businessRegNo: '91510100MA63GF2A8W', bankName: 'ICBC Chengdu Branch', bankAccount: '****4490' },
  { id: 'MCH-0007', merchantName: 'Fairmont Hangzhou', businessName: 'Fairmont (Hangzhou) Hotels Co., Ltd.', ownerName: 'David Sun', category: 'hotel', city: 'Hangzhou', country: 'CN', phone: '+86 571-8888-7777', email: 'fairmont@hz.com', stars: 5, rooms: 378, status: 'active', verificationStatus: 'approved', commissionPlan: 'premium', commissionRate: 8, joinDate: '2020-09-10', lastLogin: '2024-12-12 09:00', monthlyRevenue: 980000, monthlyBookings: 241, isVip: false, businessRegNo: '91330100MA28KH5G0F', bankName: 'Bank of Hangzhou', bankAccount: '****8820' },
  { id: 'MCH-0008', merchantName: 'InterContinental Xiamen', businessName: 'IHG Hotels (Xiamen) Co., Ltd.', ownerName: 'Linda Wu', category: 'hotel', city: 'Xiamen', country: 'CN', phone: '+86 592-2020-3888', email: 'ihg@intercontinental-xm.com', stars: 5, rooms: 302, status: 'active', verificationStatus: 'approved', commissionPlan: 'standard', commissionRate: 10, joinDate: '2021-12-05', lastLogin: '2024-12-11 15:30', monthlyRevenue: 840000, monthlyBookings: 198, isVip: false, businessRegNo: '91350200MA31LQ8T7X', bankName: 'Agricultural Bank Xiamen', bankAccount: '****1167' },
  { id: 'MCH-0009', merchantName: 'Radisson Blu Wuhan', businessName: 'Radisson (Wuhan) Hotel Management Ltd.', ownerName: 'Robert Chen', category: 'hotel', city: 'Wuhan', country: 'CN', phone: '+86 27-8888-3333', email: 'radisson@wuhan-rb.com', stars: 4, rooms: 418, status: 'active', verificationStatus: 'approved', commissionPlan: 'standard', commissionRate: 10, joinDate: '2022-03-18', lastLogin: '2024-12-10 11:15', monthlyRevenue: 720000, monthlyBookings: 352, isVip: false, businessRegNo: '91420100MA4DRF3N2J', bankName: 'CITIC Bank Wuhan', bankAccount: '****7703' },
  { id: 'MCH-0010', merchantName: 'Novotel Nanjing East', businessName: 'Accor (Nanjing) Hotel Co., Ltd.', ownerName: 'Amy Xu', category: 'hotel', city: 'Nanjing', country: 'CN', phone: '+86 25-8888-6666', email: 'novotel@nanjing-nv.com', stars: 4, rooms: 326, status: 'active', verificationStatus: 'approved', commissionPlan: 'standard', commissionRate: 10, joinDate: '2023-06-14', lastLogin: '2024-12-14 08:00', monthlyRevenue: 520000, monthlyBookings: 287, isVip: false, businessRegNo: '91320100MA1UQXLF3E', bankName: 'Bank of Nanjing', bankAccount: '****3344' },
  { id: 'MCH-0011', merchantName: 'Wyndham Grand Qingdao', businessName: 'Wyndham (Qingdao) Co., Ltd.', ownerName: 'Tom Li', category: 'hotel', city: 'Qingdao', country: 'CN', phone: '+86 532-6888-8888', email: 'wyndham@qingdao-wg.com', stars: 4, rooms: 284, status: 'active', verificationStatus: 'approved', commissionPlan: 'standard', commissionRate: 10, joinDate: '2023-01-20', lastLogin: '2024-12-13 13:45', monthlyRevenue: 410000, monthlyBookings: 214, isVip: false, businessRegNo: '91370200MA3BKHL72X', bankName: 'CCB Qingdao', bankAccount: '****9087' },
  { id: 'MCH-0012', merchantName: 'Hampton Inn Tianjin', businessName: 'Hilton (Tianjin) Budget Hotels Ltd.', ownerName: 'Nancy Zhou', category: 'hotel', city: 'Tianjin', country: 'CN', phone: '+86 22-2333-8888', email: 'hampton@tianjin-hi.com', stars: 3, rooms: 196, status: 'suspended', verificationStatus: 'approved', commissionPlan: 'standard', commissionRate: 10, joinDate: '2021-07-01', lastLogin: '2024-11-22 10:00', monthlyRevenue: 190000, monthlyBookings: 124, isVip: false, businessRegNo: '91120100MA06Q3HD8P', bankName: 'ICBC Tianjin Branch', bankAccount: '****2215' },
  { id: 'MCH-0013', merchantName: 'Sanya Bay Resort', businessName: 'Sanya Tropical Resorts Co., Ltd.', ownerName: 'Jason Huang', category: 'resort', city: 'Sanya', country: 'CN', phone: '+86 898-8858-8858', email: 'resort@sanyabay.com', stars: 5, rooms: 680, status: 'active', verificationStatus: 'approved', commissionPlan: 'vip', commissionRate: 6, joinDate: '2018-12-01', lastLogin: '2024-12-15 07:30', monthlyRevenue: 3200000, monthlyBookings: 890, isVip: true, businessRegNo: '91460200MA5TXKL24R', bankName: 'Bank of China Sanya', bankAccount: '****6678' },
  { id: 'MCH-0014', merchantName: "Xi'an Grand Tang Hotel", businessName: "Xi'an Grand Tang Hospitality Ltd.", ownerName: 'Victor Yang', category: 'boutique', city: "Xi'an", country: 'CN', phone: '+86 29-8828-8888', email: 'info@grandtang-xian.com', stars: 4, rooms: 220, status: 'active', verificationStatus: 'approved', commissionPlan: 'standard', commissionRate: 10, joinDate: '2022-05-10', lastLogin: '2024-12-09 14:10', monthlyRevenue: 380000, monthlyBookings: 176, isVip: false, businessRegNo: '91610100MA6R7XN01B', bankName: 'CCB Xi\'an Branch', bankAccount: '****8891' },
  { id: 'MCH-0015', merchantName: 'Kunming Dianchi Lakeside', businessName: 'Kunming Lakeview Hotels Co., Ltd.', ownerName: 'Helen Fang', category: 'resort', city: 'Kunming', country: 'CN', phone: '+86 871-6666-8888', email: 'info@dianchi-resort.com', stars: 4, rooms: 312, status: 'active', verificationStatus: 'approved', commissionPlan: 'standard', commissionRate: 10, joinDate: '2022-09-15', lastLogin: '2024-12-14 16:50', monthlyRevenue: 440000, monthlyBookings: 231, isVip: false, businessRegNo: '91530100MA6N5JQK8D', bankName: 'Agricultural Bank Kunming', bankAccount: '****3312' },
  { id: 'MCH-0016', merchantName: 'Suzhou Lakeside Boutique', businessName: 'Suzhou Garden Hotels Ltd.', ownerName: 'Peter Qian', category: 'boutique', city: 'Suzhou', country: 'CN', phone: '+86 512-6888-2888', email: 'info@lakeside-suzhou.com', stars: 4, rooms: 88, status: 'active', verificationStatus: 'pending', commissionPlan: 'standard', commissionRate: 10, joinDate: '2024-10-01', lastLogin: '2024-12-08 11:20', monthlyRevenue: 180000, monthlyBookings: 98, isVip: false, businessRegNo: '91320500MA27YQ3F8G', bankName: 'Bank of Suzhou', bankAccount: '****7761' },
  { id: 'MCH-0017', merchantName: 'Zhengzhou Central Plaza Hotel', businessName: 'Zhengzhou Central Hospitality Co.', ownerName: 'Tony Wu', category: 'hotel', city: 'Zhengzhou', country: 'CN', phone: '+86 371-6588-8888', email: 'info@zzcentral.com', stars: 4, rooms: 380, status: 'active', verificationStatus: 'pending', commissionPlan: 'standard', commissionRate: 10, joinDate: '2024-11-15', lastLogin: '2024-12-10 09:30', monthlyRevenue: 310000, monthlyBookings: 162, isVip: false, businessRegNo: '91410100MA4XPGDL1C', bankName: 'ICBC Zhengzhou Branch', bankAccount: '****4423' },
  { id: 'MCH-0018', merchantName: 'Changsha Riverside Inn', businessName: 'Changsha River Hotel Management Ltd.', ownerName: 'Maggie Deng', category: 'guesthouse', city: 'Changsha', country: 'CN', phone: '+86 731-8888-4444', email: 'info@riverinn-cs.com', stars: 3, rooms: 142, status: 'active', verificationStatus: 'pending', commissionPlan: 'standard', commissionRate: 10, joinDate: '2024-11-28', lastLogin: '2024-12-12 14:00', monthlyRevenue: 120000, monthlyBookings: 89, isVip: false, businessRegNo: '91430100MA4T9JV05B', bankName: 'CCB Changsha Branch', bankAccount: '****6690' },
  { id: 'MCH-0019', merchantName: 'Fuzhou Hot Spring Resort', businessName: 'Fuzhou Thermal Springs Tourism Ltd.', ownerName: 'Chris Lin', category: 'resort', city: 'Fuzhou', country: 'CN', phone: '+86 591-8888-7777', email: 'info@fz-hotspring.com', stars: 4, rooms: 268, status: 'inactive', verificationStatus: 'pending', commissionPlan: 'standard', commissionRate: 10, joinDate: '2024-12-01', lastLogin: 'Never', monthlyRevenue: 0, monthlyBookings: 0, isVip: false, businessRegNo: '91350100MA33PMKX6T', bankName: 'Bank of Fuzhou', bankAccount: '****1198' },
  { id: 'MCH-0020', merchantName: 'Hefei Tech Hub Apartments', businessName: 'Hefei Smart Living Properties Ltd.', ownerName: 'Anna Jiang', category: 'serviced_apartment', city: 'Hefei', country: 'CN', phone: '+86 551-6558-8888', email: 'info@techub-hf.com', stars: 3, rooms: 200, status: 'inactive', verificationStatus: 'rejected', commissionPlan: 'standard', commissionRate: 10, joinDate: '2024-09-01', lastLogin: '2024-10-05 08:00', monthlyRevenue: 0, monthlyBookings: 0, isVip: false, businessRegNo: '91340100MA2W4XJB7A', bankName: 'Industrial Bank Hefei', bankAccount: '****9934' },
  { id: 'MCH-0021', merchantName: 'Wuxi Lakview Hotel', businessName: 'Wuxi Taihu Tourism Hotel Co.', ownerName: 'Philip Shen', category: 'hotel', city: 'Wuxi', country: 'CN', phone: '+86 510-8288-8888', email: 'info@lakeview-wx.com', stars: 4, rooms: 296, status: 'active', verificationStatus: 'resubmission', commissionPlan: 'standard', commissionRate: 10, joinDate: '2024-08-10', lastLogin: '2024-12-05 10:15', monthlyRevenue: 260000, monthlyBookings: 143, isVip: false, businessRegNo: '91320200MA1Y8NH32P', bankName: 'Bank of Wuxi', bankAccount: '****5572' },
  { id: 'MCH-0022', merchantName: 'Guilin Karst Mountain Resort', businessName: 'Guilin Landscape Hotels Ltd.', ownerName: 'Nicole Wei', category: 'resort', city: 'Guilin', country: 'CN', phone: '+86 773-2828-8888', email: 'resort@karst-guilin.com', stars: 5, rooms: 450, status: 'active', verificationStatus: 'approved', commissionPlan: 'premium', commissionRate: 8, joinDate: '2020-04-01', lastLogin: '2024-12-14 12:40', monthlyRevenue: 820000, monthlyBookings: 318, isVip: false, businessRegNo: '91450300MA5XWKJ2HF', bankName: 'Agricultural Bank Guilin', bankAccount: '****4488' },
  { id: 'MCH-0023', merchantName: 'Harbin Ice Hotel', businessName: 'Harbin Winter Tourism Hotels Ltd.', ownerName: 'Samuel Gao', category: 'boutique', city: 'Harbin', country: 'CN', phone: '+86 451-8888-3333', email: 'info@harbin-icehotel.com', stars: 4, rooms: 180, status: 'active', verificationStatus: 'approved', commissionPlan: 'standard', commissionRate: 10, joinDate: '2021-11-20', lastLogin: '2024-12-13 16:00', monthlyRevenue: 290000, monthlyBookings: 134, isVip: false, businessRegNo: '91230100MA18CQX02B', bankName: 'Bank of Harbin', bankAccount: '****7712' },
  { id: 'MCH-0024', merchantName: 'Lhasa Potala View Hotel', businessName: 'Lhasa Sacred Land Hotels Co.', ownerName: 'Tenzin Dorje', category: 'boutique', city: 'Lhasa', country: 'CN', phone: '+86 891-638-8888', email: 'info@potalaview.com', stars: 4, rooms: 120, status: 'active', verificationStatus: 'approved', commissionPlan: 'standard', commissionRate: 10, joinDate: '2022-06-01', lastLogin: '2024-12-11 09:00', monthlyRevenue: 210000, monthlyBookings: 88, isVip: false, businessRegNo: '91540100MA6QTXN12A', bankName: 'Agricultural Bank Lhasa', bankAccount: '****3309' },
  { id: 'MCH-0025', merchantName: 'Urumqi Silk Road Hotel', businessName: 'Urumqi Xinjiang International Hotels Ltd.', ownerName: 'Mahmoud Yusuf', category: 'hotel', city: 'Urumqi', country: 'CN', phone: '+86 991-8888-1234', email: 'info@silkroad-urumqi.com', stars: 4, rooms: 320, status: 'active', verificationStatus: 'approved', commissionPlan: 'standard', commissionRate: 10, joinDate: '2021-03-25', lastLogin: '2024-12-12 14:00', monthlyRevenue: 350000, monthlyBookings: 198, isVip: false, businessRegNo: '91650100MA7MTXQ53C', bankName: 'Agricultural Bank Xinjiang', bankAccount: '****8826' },
  { id: 'MCH-0026', merchantName: 'Chongqing Skyline Hotel', businessName: 'Chongqing Mountain City Hotels Co.', ownerName: 'Ray Tang', category: 'hotel', city: 'Chongqing', country: 'CN', phone: '+86 23-8888-5555', email: 'info@skyline-cq.com', stars: 4, rooms: 398, status: 'suspended', verificationStatus: 'approved', commissionPlan: 'standard', commissionRate: 10, joinDate: '2020-12-10', lastLogin: '2024-10-14 08:00', monthlyRevenue: 0, monthlyBookings: 0, isVip: false, businessRegNo: '91500100MA5YNXG46D', bankName: 'Bank of Chongqing', bankAccount: '****6613' },
  { id: 'MCH-0027', merchantName: 'Macau Galaxy Serviced Suites', businessName: 'Galaxy Entertainment (Macau) Ltd.', ownerName: 'Francis Ho', category: 'serviced_apartment', city: 'Macau', country: 'MO', phone: '+853 2888-0000', email: 'suites@galaxyentertainment.com', stars: 5, rooms: 540, status: 'active', verificationStatus: 'approved', commissionPlan: 'vip', commissionRate: 6, joinDate: '2019-07-01', lastLogin: '2024-12-15 11:50', monthlyRevenue: 1800000, monthlyBookings: 620, isVip: true, businessRegNo: 'MO88123456', bankName: 'BNU Macau Branch', bankAccount: '****9901' },
  { id: 'MCH-0028', merchantName: 'Hong Kong Langham Hotel', businessName: 'Langham Hospitality (HK) Ltd.', ownerName: 'Vivian Cheung', category: 'hotel', city: 'Hong Kong', country: 'HK', phone: '+852 2375-1133', email: 'res@langhamhk.com', stars: 5, rooms: 498, status: 'active', verificationStatus: 'approved', commissionPlan: 'vip', commissionRate: 6, joinDate: '2018-09-15', lastLogin: '2024-12-15 09:45', monthlyRevenue: 2100000, monthlyBookings: 541, isVip: true, businessRegNo: 'HK12345678', bankName: 'HSBC Hong Kong', bankAccount: '****4412' },
  { id: 'MCH-0029', merchantName: 'Singapore Marina Bay Hostel', businessName: 'Bay Hostel Holdings Pte. Ltd.', ownerName: 'Alex Tan', category: 'hostel', city: 'Singapore', country: 'SG', phone: '+65 6789-0123', email: 'info@marinabay-hostel.sg', stars: 2, rooms: 80, status: 'active', verificationStatus: 'pending', commissionPlan: 'standard', commissionRate: 10, joinDate: '2024-11-10', lastLogin: '2024-12-07 14:30', monthlyRevenue: 68000, monthlyBookings: 145, isVip: false, businessRegNo: 'SG202400001A', bankName: 'DBS Bank Singapore', bankAccount: '****3387' },
  { id: 'MCH-0030', merchantName: 'Bangkok Silom Boutique', businessName: 'Silom Hotel Management Co. Ltd.', ownerName: 'Kanya Sukrit', category: 'boutique', city: 'Bangkok', country: 'TH', phone: '+66 2-234-5678', email: 'info@silom-boutique.th', stars: 3, rooms: 96, status: 'active', verificationStatus: 'pending', commissionPlan: 'standard', commissionRate: 10, joinDate: '2024-12-01', lastLogin: '2024-12-08 08:15', monthlyRevenue: 54000, monthlyBookings: 112, isVip: false, businessRegNo: 'TH0105558000001', bankName: 'Bangkok Bank', bankAccount: '****2201' },
]

// ─── Verification Applications ─────────────────────────────────────────────
export const verifApplications: VerifApplication[] = merchants.filter(m =>
  ['pending', 'rejected', 'resubmission'].includes(m.verificationStatus)
).map(m => ({
  applicationId: `APP-${m.id.replace('MCH-', '2024')}`,
  merchantId: m.id,
  merchantName: m.merchantName,
  businessName: m.businessName,
  businessRegNo: m.businessRegNo,
  ownerName: m.ownerName,
  ownerIdNo: `****${Math.floor(1000 + Math.random() * 9000)}`,
  phone: m.phone,
  email: m.email,
  city: m.city,
  category: m.category,
  submittedDate: m.joinDate,
  status: m.verificationStatus,
  reviewer: ['Zhang Min', 'Li Hao', 'Wang Fei', 'Chen Jing', 'Unassigned'][Math.floor(Math.random() * 5)],
  notes: m.verificationStatus === 'rejected' ? 'Business registration document appears to be expired. Please provide valid documents.' : m.verificationStatus === 'resubmission' ? 'Hotel license missing. Please resubmit with valid hotel operating license.' : '',
  documents: [
    { name: 'Business Registration Certificate', type: 'business_reg', status: m.verificationStatus === 'rejected' ? 'rejected' : 'pending' as 'verified' | 'pending' | 'rejected' },
    { name: 'Hotel Operating License', type: 'hotel_license', status: m.verificationStatus === 'resubmission' ? 'rejected' : 'pending' as 'verified' | 'pending' | 'rejected' },
    { name: "Owner's Identity Document", type: 'id_doc', status: 'pending' as 'verified' | 'pending' | 'rejected' },
    { name: 'Bank Account Verification Letter', type: 'bank_letter', status: 'pending' as 'verified' | 'pending' | 'rejected' },
    { name: 'Tax Registration Certificate', type: 'tax_cert', status: 'pending' as 'verified' | 'pending' | 'rejected' },
  ],
  timeline: [
    { date: m.joinDate, action: 'Application submitted', by: m.ownerName },
    { date: m.joinDate.replace(/-\d{2}$/, '-' + (parseInt(m.joinDate.slice(-2)) + 1)), action: 'Application received and queued for review', by: 'System' },
  ],
}))

// Also add approved ones for search
export const allApplications: VerifApplication[] = [
  ...verifApplications,
  ...merchants.filter(m => m.verificationStatus === 'approved').slice(0, 5).map(m => ({
    applicationId: `APP-${m.id.replace('MCH-', '2023')}`,
    merchantId: m.id,
    merchantName: m.merchantName,
    businessName: m.businessName,
    businessRegNo: m.businessRegNo,
    ownerName: m.ownerName,
    ownerIdNo: `****${Math.floor(1000 + Math.random() * 9000)}`,
    phone: m.phone,
    email: m.email,
    city: m.city,
    category: m.category,
    submittedDate: m.joinDate,
    status: 'approved' as VerifStatus,
    reviewer: 'Zhang Min',
    notes: 'All documents verified. Merchant approved.',
    documents: [
      { name: 'Business Registration Certificate', type: 'business_reg', status: 'verified' as 'verified' | 'pending' | 'rejected' },
      { name: 'Hotel Operating License', type: 'hotel_license', status: 'verified' as 'verified' | 'pending' | 'rejected' },
      { name: "Owner's Identity Document", type: 'id_doc', status: 'verified' as 'verified' | 'pending' | 'rejected' },
      { name: 'Bank Account Verification Letter', type: 'bank_letter', status: 'verified' as 'verified' | 'pending' | 'rejected' },
      { name: 'Tax Registration Certificate', type: 'tax_cert', status: 'verified' as 'verified' | 'pending' | 'rejected' },
    ],
    timeline: [
      { date: m.joinDate, action: 'Application submitted', by: m.ownerName },
      { date: m.joinDate, action: 'Documents received', by: 'System' },
      { date: m.joinDate, action: 'Review completed — Approved', by: 'Zhang Min' },
    ],
  })),
]

// ─── Bookings (50) ─────────────────────────────────────────────────────────
const bMerchants = merchants.filter(m => m.status === 'active').slice(0, 18)
const rooms = ['Deluxe King', 'Superior Twin', 'Premier Suite', 'Executive Room', 'Club Room', 'Family Suite', 'Sea View Room', 'Mountain View Suite']
const channels = ['Ctrip', 'Meituan', 'Fliggy', 'Direct', 'Agoda', 'Booking.com', 'Corporate']
const guests = [
  ['Zhang Wei', '+86 138****4521', 'zhangwei@163.com'],
  ['Li Mei', '+86 135****8842', 'limei@126.com'],
  ['Wang Fang', '+86 139****6631', 'wangfang@qq.com'],
  ['Chen Jian', '+86 186****2290', 'chenjian@gmail.com'],
  ['Liu Yang', '+86 177****9081', 'liuyang@sina.com'],
  ['Zhao Xin', '+86 182****3317', 'zhaoxin@hotmail.com'],
  ['Wu Lei', '+86 151****4409', 'wulei@163.com'],
  ['Sun Li', '+86 158****7726', 'sunli@126.com'],
  ['Huang Tao', '+86 136****8853', 'huangtao@qq.com'],
  ['Zhou Qian', '+86 133****2205', 'zhouqian@163.com'],
  ['Xu Ming', '+86 188****6640', 'xuming@gmail.com'],
  ['Ma Jing', '+86 139****1134', 'majing@sina.com'],
  ['He Yan', '+86 150****2287', 'heyan@163.com'],
  ['Luo Bin', '+86 176****9921', 'luobin@126.com'],
  ['Song Yun', '+86 157****4430', 'songyun@qq.com'],
]
const bStatuses: BookingStatus[] = ['confirmed', 'completed', 'cancelled', 'no_show', 'checked_in']
const rStatuses: RefundStatus[] = ['none', 'none', 'none', 'requested', 'approved', 'processed', 'rejected']
const sStatuses: SettlementStatus[] = ['settled', 'settled', 'pending', 'processing', 'overdue']

export const bookings: Booking[] = Array.from({ length: 50 }, (_, i) => {
  const m = bMerchants[i % bMerchants.length]
  const g = guests[i % guests.length]
  const bs = bStatuses[i % bStatuses.length]
  const rs = bs === 'cancelled' ? rStatuses[Math.floor(i / 5) % rStatuses.length] : 'none'
  const ss: SettlementStatus = bs === 'completed' ? sStatuses[i % sStatuses.length] : bs === 'confirmed' ? 'pending' : 'pending'
  const nights = (i % 4) + 1
  const amount = Math.round((800 + (i * 312) % 4200) / 100) * 100
  const d = new Date(2024, 11, 1 + (i % 28))
  const checkIn = d.toISOString().slice(0, 10)
  const co = new Date(d.getTime() + nights * 86400000)
  return {
    id: `BK-2024-${84700 + i}`,
    merchantId: m.id,
    merchantName: m.merchantName,
    hotelName: m.merchantName,
    guestName: g[0],
    guestPhone: g[1],
    guestEmail: g[2],
    checkIn,
    checkOut: co.toISOString().slice(0, 10),
    nights,
    roomType: rooms[i % rooms.length],
    amount,
    commission: Math.round(amount * m.commissionRate / 100),
    bookingStatus: bs,
    refundStatus: rs,
    refundAmount: rs !== 'none' ? amount : undefined,
    settlementStatus: ss,
    channel: channels[i % channels.length],
    createdAt: `2024-12-${String(1 + (i % 14)).padStart(2, '0')} ${String(8 + (i % 12)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}`,
    promotionCode: i % 5 === 0 ? `MTRIP${10 + i}` : undefined,
  }
})

// ─── Campaigns (15) ────────────────────────────────────────────────────────
export const campaigns: Campaign[] = [
  { id: 'CP-2024-001', name: 'Christmas Campaign 2024',       type: 'seasonal',    status: 'active',    startDate: '2024-12-20', endDate: '2024-12-26', budget: 500000,  spent: 312000, goal: 'Drive bookings over Christmas week across premium properties',           merchantCount: 48, totalClaims: 12840, conversions: 9208,  revenue: 4820000,  createdBy: 'Admin Zhang', linkedVouchers: 2, linkedCodes: 1, owner: 'platform' },
  { id: 'CP-2024-002', name: 'Winter Escape Campaign',        type: 'flash_sale',  status: 'active',    startDate: '2024-12-01', endDate: '2024-12-31', budget: 400000,  spent: 248000, goal: 'Flash discounts on winter travel to boost Q4 occupancy rates',          merchantCount: 62, totalClaims: 18200, conversions: 13050, revenue: 6840000,  createdBy: 'Admin Li',    linkedVouchers: 1, linkedCodes: 2, owner: 'platform' },
  { id: 'CP-2024-003', name: 'Business Travel Campaign',      type: 'partnership', status: 'active',    startDate: '2024-12-01', endDate: '2024-12-31', budget: 300000,  spent: 210000, goal: 'Corporate partnerships targeting business travellers and SME clients',   merchantCount: 18, totalClaims: 8600,  conversions: 6880,  revenue: 4128000,  createdBy: 'Admin Zhang', linkedVouchers: 0, linkedCodes: 3, owner: 'merchant', merchantOwner: 'MCH-0001 · The Peninsula Beijing' },
  { id: 'CP-2024-004', name: 'Loyalty Rewards Campaign',      type: 'loyalty',     status: 'active',    startDate: '2024-11-15', endDate: '2025-01-15', budget: 200000,  spent: 112000, goal: 'Retain high-value members with double points and exclusive perks',       merchantCount: 89, totalClaims: 24800, conversions: 18600, revenue: 9300000,  createdBy: 'Admin Chen',  linkedVouchers: 1, linkedCodes: 0, owner: 'platform' },
  { id: 'CP-2024-005', name: 'Summer Escape Campaign',        type: 'seasonal',    status: 'ended',     startDate: '2024-07-01', endDate: '2024-08-31', budget: 600000,  spent: 594000, goal: 'Peak summer demand across beach resorts and leisure properties',         merchantCount: 36, totalClaims: 32400, conversions: 24300, revenue: 14580000, createdBy: 'Admin Li',    linkedVouchers: 3, linkedCodes: 2, owner: 'platform' },
  { id: 'CP-2024-006', name: 'Sanya Beach Week',              type: 'seasonal',    status: 'ended',     startDate: '2024-10-01', endDate: '2024-10-07', budget: 180000,  spent: 178000, goal: 'Golden Week promotion exclusively for Sanya beachfront hotels',          merchantCount: 8,  totalClaims: 5640,  conversions: 4512,  revenue: 4059000,  createdBy: 'Admin Wang',  linkedVouchers: 1, linkedCodes: 1, owner: 'merchant', merchantOwner: 'MCH-0013 · Sanya Bay Resort' },
  { id: 'CP-2024-007', name: 'New User Acquisition Campaign', type: 'referral',    status: 'active',    startDate: '2024-01-01', endDate: '2024-12-31', budget: 800000,  spent: 698000, goal: 'Acquire first-time bookers and reduce bounce rate on first visit',       merchantCount: 0,  totalClaims: 52400, conversions: 52400, revenue: 20960000, createdBy: 'Admin Chen',  linkedVouchers: 2, linkedCodes: 0, owner: 'platform' },
  { id: 'CP-2024-008', name: 'App Exclusive Campaign',        type: 'flash_sale',  status: 'active',    startDate: '2024-12-01', endDate: '2024-12-31', budget: 350000,  spent: 252000, goal: 'Drive app downloads and mobile bookings with exclusive app-only deals',  merchantCount: 62, totalClaims: 18000, conversions: 14400, revenue: 10080000, createdBy: 'Admin Chen',  linkedVouchers: 0, linkedCodes: 2, owner: 'platform' },
  { id: 'CP-2024-009', name: 'Spring Festival Campaign 2025', type: 'seasonal',    status: 'scheduled', startDate: '2025-01-25', endDate: '2025-02-05', budget: 500000,  spent: 0,      goal: 'Capture Lunar New Year travel surge across all major cities',            merchantCount: 55, totalClaims: 0,     conversions: 0,     revenue: 0,        createdBy: 'Admin Zhang', linkedVouchers: 2, linkedCodes: 2, owner: 'platform' },
  { id: 'CP-2024-010', name: 'Early Bird 2025 Campaign',      type: 'flash_sale',  status: 'draft',     startDate: '',           endDate: '',           budget: 250000,  spent: 0,      goal: 'Early booking incentives for Q1 2025 to smooth seasonal demand troughs', merchantCount: 0,  totalClaims: 0,     conversions: 0,     revenue: 0,        createdBy: 'Admin Li',    linkedVouchers: 0, linkedCodes: 0, owner: 'merchant', merchantOwner: 'MCH-0002 · Grand Hyatt Shanghai' },
]

// ─── Vouchers (10) ────────────────────────────────────────────────────────
export const vouchers: Voucher[] = [
  { id: 'VCH-2024-001', name: 'Christmas VIP Voucher',        campaignId: 'CP-2024-001', voucherType: 'fixed',      value: 200, valueDisplay: '¥200 off',    status: 'active',    startDate: '2024-12-20', endDate: '2024-12-26', quantity: 5000,  claimed: 3200,  redeemed: 2140, minSpend: 1000, perUserLimit: 1, totalRedemptionLimit: 5000,  merchantScope: 'selected', merchantCount: 22, createdBy: 'Admin Li',    createdAt: '2024-11-28' },
  { id: 'VCH-2024-002', name: 'Holiday Welcome Voucher',      campaignId: 'CP-2024-001', voucherType: 'percentage', value: 15,  valueDisplay: '15% off',     status: 'active',    startDate: '2024-12-20', endDate: '2024-12-31', quantity: 10000, claimed: 6800,  redeemed: 4896, minSpend: 600,  perUserLimit: 1, totalRedemptionLimit: 10000, merchantScope: 'all',      merchantCount: 0,  createdBy: 'Admin Zhang', createdAt: '2024-11-28' },
  { id: 'VCH-2024-003', name: 'Winter Flash Voucher',         campaignId: 'CP-2024-002', voucherType: 'fixed',      value: 150, valueDisplay: '¥150 off',    status: 'active',    startDate: '2024-12-01', endDate: '2024-12-31', quantity: 8000,  claimed: 5120,  redeemed: 3584, minSpend: 700,  perUserLimit: 2, totalRedemptionLimit: 8000,  merchantScope: 'all',      merchantCount: 0,  createdBy: 'Admin Li',    createdAt: '2024-11-20' },
  { id: 'VCH-2024-004', name: 'Loyalty Member Voucher',       campaignId: 'CP-2024-004', voucherType: 'upgrade',    value: 0,   valueDisplay: 'Free upgrade', status: 'active',    startDate: '2024-12-01', endDate: '2025-02-28', quantity: 2000,  claimed: 1800,  redeemed: 1440, minSpend: 2000, perUserLimit: 1, totalRedemptionLimit: 2000,  merchantScope: 'selected', merchantCount: 15, createdBy: 'Admin Wang',  createdAt: '2024-11-15' },
  { id: 'VCH-2024-005', name: 'First Booking Voucher',        campaignId: 'CP-2024-007', voucherType: 'fixed',      value: 100, valueDisplay: '¥100 off',    status: 'active',    startDate: '2024-01-01', endDate: '2024-12-31', quantity: 99999, claimed: 52400, redeemed: 52400, minSpend: 400, perUserLimit: 1, totalRedemptionLimit: 99999, merchantScope: 'all',      merchantCount: 0,  createdBy: 'Admin Chen',  createdAt: '2024-01-01' },
  { id: 'VCH-2024-006', name: 'New User Welcome Voucher',     campaignId: 'CP-2024-007', voucherType: 'percentage', value: 20,  valueDisplay: '20% off',     status: 'active',    startDate: '2024-06-01', endDate: '2024-12-31', quantity: 30000, claimed: 18400, redeemed: 12880, minSpend: 300, perUserLimit: 1, totalRedemptionLimit: 30000, merchantScope: 'all',      merchantCount: 0,  createdBy: 'Admin Chen',  createdAt: '2024-05-20' },
  { id: 'VCH-2024-007', name: 'Summer Resort Voucher',        campaignId: 'CP-2024-005', voucherType: 'fixed',      value: 300, valueDisplay: '¥300 off',    status: 'expired',   startDate: '2024-07-01', endDate: '2024-08-31', quantity: 6000,  claimed: 5840,  redeemed: 4668, minSpend: 1500, perUserLimit: 1, totalRedemptionLimit: 6000,  merchantScope: 'selected', merchantCount: 28, createdBy: 'Admin Li',    createdAt: '2024-06-15' },
  { id: 'VCH-2024-008', name: 'Sanya Exclusive Voucher',      campaignId: 'CP-2024-006', voucherType: 'free_night', value: 1,   valueDisplay: '1 Free Night', status: 'expired',   startDate: '2024-10-01', endDate: '2024-10-07', quantity: 500,   claimed: 488,   redeemed: 420,  minSpend: 2000, perUserLimit: 1, totalRedemptionLimit: 500,   merchantScope: 'selected', merchantCount: 8,  createdBy: 'Admin Wang',  createdAt: '2024-09-20' },
  { id: 'VCH-2024-009', name: 'HK & Macau Bundle Voucher',    campaignId: null,          voucherType: 'fixed',      value: 300, valueDisplay: '¥300 off',    status: 'draft',     startDate: '',           endDate: '',           quantity: 3000,  claimed: 0,     redeemed: 0,    minSpend: 1500, perUserLimit: 1, totalRedemptionLimit: 3000,  merchantScope: 'selected', merchantCount: 6,  createdBy: 'Admin Li',    createdAt: '2024-12-10' },
  { id: 'VCH-2024-010', name: 'Spring Festival Voucher 2025', campaignId: 'CP-2024-009', voucherType: 'percentage', value: 18,  valueDisplay: '18% off',     status: 'scheduled', startDate: '2025-01-25', endDate: '2025-02-05', quantity: 20000, claimed: 0,     redeemed: 0,    minSpend: 800,  perUserLimit: 2, totalRedemptionLimit: 20000, merchantScope: 'all',      merchantCount: 0,  createdBy: 'Admin Zhang', createdAt: '2024-12-15' },
]

// ─── Promo Codes (10) ──────────────────────────────────────────────────────
export const promoCodes: PromoCode[] = [
  { id: 'PC-2024-001', code: 'XMAS2024',    name: 'Christmas Promo Code',      campaignId: 'CP-2024-001', discountType: 'percentage', discountValue: 20,  discountDisplay: '20% off',    status: 'active',    startDate: '2024-12-20', endDate: '2024-12-26', usageLimit: 10000, usageCount: 7240,  perUserLimit: 1, minSpend: 800,  stackable: false, merchantScope: 'selected', merchantCount: 22, createdBy: 'Admin Zhang', createdAt: '2024-11-28' },
  { id: 'PC-2024-002', code: 'WINTER20',    name: 'Winter Escape Promo',       campaignId: 'CP-2024-002', discountType: 'percentage', discountValue: 20,  discountDisplay: '20% off',    status: 'active',    startDate: '2024-12-01', endDate: '2024-12-31', usageLimit: 15000, usageCount: 9360,  perUserLimit: 2, minSpend: 500,  stackable: false, merchantScope: 'all',      merchantCount: 0,  createdBy: 'Admin Li',    createdAt: '2024-11-20' },
  { id: 'PC-2024-003', code: 'WKND20',      name: 'Weekend Staycation Code',   campaignId: 'CP-2024-002', discountType: 'percentage', discountValue: 12,  discountDisplay: '12% off',    status: 'active',    startDate: '2024-12-07', endDate: '2024-12-29', usageLimit: 8000,  usageCount: 5740,  perUserLimit: 1, minSpend: 400,  stackable: false, merchantScope: 'selected', merchantCount: 44, createdBy: 'Admin Zhang', createdAt: '2024-12-01' },
  { id: 'PC-2024-004', code: 'BIZTRAVEL15', name: 'Business Travel Code',      campaignId: 'CP-2024-003', discountType: 'percentage', discountValue: 15,  discountDisplay: '15% off',    status: 'active',    startDate: '2024-12-01', endDate: '2024-12-31', usageLimit: 6000,  usageCount: 5120,  perUserLimit: 3, minSpend: 600,  stackable: false, merchantScope: 'selected', merchantCount: 18, createdBy: 'Admin Zhang', createdAt: '2024-11-20' },
  { id: 'PC-2024-005', code: 'CORPRATE10',  name: 'Mid-Week Corporate Rate',   campaignId: 'CP-2024-003', discountType: 'percentage', discountValue: 10,  discountDisplay: '10% off',    status: 'paused',    startDate: '2024-12-02', endDate: '2024-12-30', usageLimit: 4000,  usageCount: 2170,  perUserLimit: 5, minSpend: 500,  stackable: true,  merchantScope: 'selected', merchantCount: 20, createdBy: 'Admin Li',    createdAt: '2024-11-25' },
  { id: 'PC-2024-006', code: 'CORPDEAL',    name: 'Corporate Annual Deal',     campaignId: 'CP-2024-003', discountType: 'fixed',      discountValue: 200, discountDisplay: '¥200 off',   status: 'active',    startDate: '2024-12-01', endDate: '2024-12-31', usageLimit: 2000,  usageCount: 1560,  perUserLimit: 10, minSpend: 1200, stackable: false, merchantScope: 'selected', merchantCount: 8,  createdBy: 'Admin Wang',  createdAt: '2024-11-22' },
  { id: 'PC-2024-007', code: 'APPONLY22',   name: 'App-Only Exclusive Code',   campaignId: 'CP-2024-008', discountType: 'percentage', discountValue: 22,  discountDisplay: '22% off',    status: 'active',    startDate: '2024-12-01', endDate: '2024-12-31', usageLimit: 20000, usageCount: 14400, perUserLimit: 1, minSpend: 700,  stackable: false, merchantScope: 'all',      merchantCount: 0,  createdBy: 'Admin Chen',  createdAt: '2024-11-20' },
  { id: 'PC-2024-008', code: 'APPDEAL15',   name: 'App Download Bonus Code',   campaignId: 'CP-2024-008', discountType: 'fixed',      discountValue: 150, discountDisplay: '¥150 off',   status: 'active',    startDate: '2024-12-10', endDate: '2024-12-31', usageLimit: 5000,  usageCount: 2840,  perUserLimit: 1, minSpend: 500,  stackable: false, merchantScope: 'all',      merchantCount: 0,  createdBy: 'Admin Chen',  createdAt: '2024-12-08' },
  { id: 'PC-2024-009', code: 'SANYA18',     name: 'Sanya October Code',        campaignId: 'CP-2024-006', discountType: 'percentage', discountValue: 18,  discountDisplay: '18% off',    status: 'expired',   startDate: '2024-10-01', endDate: '2024-10-07', usageLimit: 2000,  usageCount: 1984,  perUserLimit: 1, minSpend: 900,  stackable: false, merchantScope: 'selected', merchantCount: 8,  createdBy: 'Admin Wang',  createdAt: '2024-09-20' },
  { id: 'PC-2024-010', code: 'CNY2025',     name: 'Spring Festival 2025 Code', campaignId: 'CP-2024-009', discountType: 'percentage', discountValue: 15,  discountDisplay: '15% off',    status: 'scheduled', startDate: '2025-01-25', endDate: '2025-02-05', usageLimit: 25000, usageCount: 0,     perUserLimit: 2, minSpend: 600,  stackable: false, merchantScope: 'all',      merchantCount: 0,  createdBy: 'Admin Zhang', createdAt: '2024-12-15' },
]


// ─── Affiliates (20) ──────────────────────────────────────────────────────
export const affiliates: Affiliate[] = [
  { id: 'AFF-001', name: 'TravelWithLily', handle: '@travelwithlily', type: 'influencer', platform: 'Xiaohongshu', followers: 2840000, status: 'active', commissionRate: 8, totalEarnings: 184200, withdrawable: 24800, totalReferrals: 9210, conversions: 5526, joinDate: '2022-03-15', lastActivity: '2024-12-14', fraudScore: 2 },
  { id: 'AFF-002', name: 'Jason Hotel Reviews', handle: '@jasonhotels', type: 'kol', platform: 'WeChat', followers: 1420000, status: 'active', commissionRate: 7, totalEarnings: 98400, withdrawable: 12600, totalReferrals: 5612, conversions: 3087, joinDate: '2021-08-20', lastActivity: '2024-12-13', fraudScore: 1 },
  { id: 'AFF-003', name: 'ChinaTravelBlog', handle: '@chinatravelblog', type: 'blogger', platform: 'WeChat', followers: 680000, status: 'active', commissionRate: 6, totalEarnings: 52100, withdrawable: 8400, totalReferrals: 2840, conversions: 1704, joinDate: '2022-11-10', lastActivity: '2024-12-10', fraudScore: 3 },
  { id: 'AFF-004', name: 'LuxuryHotelSeeker', handle: '@luxhotelseeker', type: 'influencer', platform: 'Douyin', followers: 5200000, status: 'active', commissionRate: 9, totalEarnings: 312000, withdrawable: 44000, totalReferrals: 18400, conversions: 9200, joinDate: '2021-05-01', lastActivity: '2024-12-15', fraudScore: 1 },
  { id: 'AFF-005', name: 'ResortFinder_CN', handle: '@resortfindercn', type: 'kol', platform: 'Xiaohongshu', followers: 980000, status: 'active', commissionRate: 7, totalEarnings: 72800, withdrawable: 18200, totalReferrals: 4120, conversions: 2060, joinDate: '2023-01-20', lastActivity: '2024-12-12', fraudScore: 4 },
  { id: 'AFF-006', name: 'BeijingTravelGuide', handle: '@bjtravelguide', type: 'blogger', platform: 'Weibo', followers: 340000, status: 'active', commissionRate: 6, totalEarnings: 28400, withdrawable: 4200, totalReferrals: 1420, conversions: 852, joinDate: '2023-04-15', lastActivity: '2024-12-08', fraudScore: 2 },
  { id: 'AFF-007', name: 'AsiaHotelDeals', handle: '@asiahoteldeals', type: 'ota_partner', platform: 'Website', followers: 120000, status: 'active', commissionRate: 5, totalEarnings: 190000, withdrawable: 28000, totalReferrals: 8400, conversions: 5880, joinDate: '2020-09-01', lastActivity: '2024-12-15', fraudScore: 0 },
  { id: 'AFF-008', name: 'MichelleWanderlust', handle: '@michellewanderlust', type: 'influencer', platform: 'Douyin', followers: 3800000, status: 'pending', commissionRate: 8, totalEarnings: 0, withdrawable: 0, totalReferrals: 0, conversions: 0, joinDate: '2024-12-10', lastActivity: '2024-12-10', fraudScore: 0 },
  { id: 'AFF-009', name: 'Corporate Travel Pro', handle: '@corptravel_pro', type: 'corporate', platform: 'Website', followers: 0, status: 'active', commissionRate: 4, totalEarnings: 480000, withdrawable: 62000, totalReferrals: 24000, conversions: 19200, joinDate: '2019-06-01', lastActivity: '2024-12-15', fraudScore: 0 },
  { id: 'AFF-010', name: 'HolidayHunter88', handle: '@holidayhunter88', type: 'influencer', platform: 'Xiaohongshu', followers: 440000, status: 'pending', commissionRate: 6, totalEarnings: 0, withdrawable: 0, totalReferrals: 0, conversions: 0, joinDate: '2024-12-05', lastActivity: '2024-12-05', fraudScore: 0 },
  { id: 'AFF-011', name: 'TravelHacking_CN', handle: '@travelhacking_cn', type: 'blogger', platform: 'WeChat', followers: 280000, status: 'suspended', commissionRate: 6, totalEarnings: 14200, withdrawable: 0, totalReferrals: 820, conversions: 328, joinDate: '2023-08-01', lastActivity: '2024-10-20', fraudScore: 72 },
  { id: 'AFF-012', name: 'ShanghaiLifestyle', handle: '@shanghailifestyle', type: 'kol', platform: 'Weibo', followers: 1840000, status: 'active', commissionRate: 7, totalEarnings: 128400, withdrawable: 22000, totalReferrals: 7320, conversions: 3660, joinDate: '2022-01-15', lastActivity: '2024-12-11', fraudScore: 3 },
  { id: 'AFF-013', name: 'BudgetTraveler_Asia', handle: '@budgettraveler_asia', type: 'blogger', platform: 'Website', followers: 92000, status: 'active', commissionRate: 5, totalEarnings: 18800, withdrawable: 3200, totalReferrals: 940, conversions: 470, joinDate: '2023-09-01', lastActivity: '2024-12-09', fraudScore: 5 },
  { id: 'AFF-014', name: 'CityHopperMike', handle: '@cityhoppermike', type: 'influencer', platform: 'Douyin', followers: 2100000, status: 'active', commissionRate: 8, totalEarnings: 204800, withdrawable: 31200, totalReferrals: 12800, conversions: 7680, joinDate: '2021-11-20', lastActivity: '2024-12-14', fraudScore: 2 },
  { id: 'AFF-015', name: 'MeetingsAsia', handle: '@meetingsasia', type: 'corporate', platform: 'Website', followers: 0, status: 'pending', commissionRate: 4, totalEarnings: 0, withdrawable: 0, totalReferrals: 0, conversions: 0, joinDate: '2024-11-25', lastActivity: '2024-11-25', fraudScore: 0 },
  { id: 'AFF-016', name: 'HotelInsiderCN', handle: '@hotelinsidercn', type: 'kol', platform: 'Xiaohongshu', followers: 620000, status: 'active', commissionRate: 6, totalEarnings: 42000, withdrawable: 6800, totalReferrals: 2100, conversions: 1260, joinDate: '2023-05-10', lastActivity: '2024-12-13', fraudScore: 1 },
  { id: 'AFF-017', name: 'SleepWellGuide', handle: '@sleepwellguide', type: 'blogger', platform: 'WeChat', followers: 180000, status: 'active', commissionRate: 5, totalEarnings: 12400, withdrawable: 2100, totalReferrals: 620, conversions: 310, joinDate: '2024-02-14', lastActivity: '2024-12-07', fraudScore: 6 },
  { id: 'AFF-018', name: 'ClickFarm99', handle: '@clickfarm99', type: 'blogger', platform: 'Weibo', followers: 2400000, status: 'suspended', commissionRate: 0, totalEarnings: 88000, withdrawable: 0, totalReferrals: 44000, conversions: 88, joinDate: '2024-06-01', lastActivity: '2024-11-15', fraudScore: 94 },
  { id: 'AFF-019', name: 'GlobalNomadTV', handle: '@globalnomadtv', type: 'influencer', platform: 'Douyin', followers: 880000, status: 'active', commissionRate: 7, totalEarnings: 66200, withdrawable: 9800, totalReferrals: 3880, conversions: 1940, joinDate: '2023-02-08', lastActivity: '2024-12-12', fraudScore: 2 },
  { id: 'AFF-020', name: 'TravelNowCorp', handle: '@travelnowcorp', type: 'ota_partner', platform: 'Website', followers: 0, status: 'active', commissionRate: 4.5, totalEarnings: 280000, withdrawable: 38000, totalReferrals: 14000, conversions: 11200, joinDate: '2020-11-01', lastActivity: '2024-12-15', fraudScore: 0 },
]


// ─── Promotions (merchant self-managed deals) ────────────────────────────────────────────────────
export interface Promotion {
  id: string
  name: string
  merchantId: string
  merchantName: string
  promotionType: 'percentage' | 'fixed' | 'package' | 'free_night' | 'early_bird'
  discountValue: number
  discountDisplay: string
  status: 'active' | 'paused' | 'expired' | 'scheduled' | 'draft'
  startDate: string
  endDate: string
  minNights: number
  bookings: number
  revenue: number
  createdAt: string
}

export const promotions: Promotion[] = [
  { id: 'PR-001', name: 'Peninsula Festive Rate',       merchantId: 'MCH-0001', merchantName: 'The Peninsula Beijing',       promotionType: 'percentage', discountValue: 20, discountDisplay: '20% OFF',        status: 'active',    startDate: '2024-12-20', endDate: '2024-12-31', minNights: 2, bookings: 184, revenue: 921000,  createdAt: '2024-12-01' },
  { id: 'PR-002', name: 'Hyatt Member Weekend Deal',    merchantId: 'MCH-0002', merchantName: 'Grand Hyatt Shanghai',        promotionType: 'fixed',      discountValue: 300, discountDisplay: 'MMK 300 OFF',   status: 'active',    startDate: '2024-12-01', endDate: '2024-12-31', minNights: 1, bookings: 256, revenue: 1280000, createdAt: '2024-11-25' },
  { id: 'PR-003', name: 'Marriott Stay & Save',         merchantId: 'MCH-0003', merchantName: 'Marriott Shenzhen',           promotionType: 'percentage', discountValue: 15, discountDisplay: '15% OFF',        status: 'active',    startDate: '2024-12-01', endDate: '2025-01-31', minNights: 2, bookings: 142, revenue: 710000,  createdAt: '2024-11-28' },
  { id: 'PR-004', name: 'Sanya All-Inclusive Package',  merchantId: 'MCH-0013', merchantName: 'Sanya Bay Resort',            promotionType: 'package',    discountValue: 0,   discountDisplay: 'All-Inclusive', status: 'active',    startDate: '2024-12-01', endDate: '2025-03-31', minNights: 3, bookings: 320, revenue: 2400000, createdAt: '2024-11-15' },
  { id: 'PR-005', name: 'Galaxy Suite Upgrade',         merchantId: 'MCH-0027', merchantName: 'Macau Galaxy Serviced Suites', promotionType: 'free_night', discountValue: 1,  discountDisplay: 'Free Night',     status: 'active',    startDate: '2024-12-15', endDate: '2025-01-15', minNights: 3, bookings: 98,  revenue: 588000,  createdAt: '2024-12-10' },
  { id: 'PR-006', name: 'Fairmont Early Bird 2025',     merchantId: 'MCH-0007', merchantName: 'Fairmont Hangzhou',           promotionType: 'early_bird', discountValue: 25, discountDisplay: '25% Early Bird', status: 'scheduled', startDate: '2025-01-01', endDate: '2025-06-30', minNights: 2, bookings: 0,   revenue: 0,       createdAt: '2024-12-05' },
  { id: 'PR-007', name: 'Hilton Weekend Escape',        merchantId: 'MCH-0004', merchantName: 'Hilton Chengdu',              promotionType: 'percentage', discountValue: 18, discountDisplay: '18% OFF',        status: 'paused',    startDate: '2024-12-01', endDate: '2024-12-31', minNights: 1, bookings: 76,  revenue: 304000,  createdAt: '2024-11-20' },
  { id: 'PR-008', name: 'Guilin Nature Retreat',        merchantId: 'MCH-0022', merchantName: 'Guilin Karst Mountain Resort', promotionType: 'package',    discountValue: 0,  discountDisplay: 'Package Deal',  status: 'active',    startDate: '2024-12-01', endDate: '2025-02-28', minNights: 2, bookings: 112, revenue: 840000,  createdAt: '2024-11-22' },
  { id: 'PR-009', name: 'Langham HK Christmas Deal',    merchantId: 'MCH-0028', merchantName: 'Hong Kong Langham Hotel',     promotionType: 'fixed',      discountValue: 200, discountDisplay: 'MMK 200 OFF',   status: 'active',    startDate: '2024-12-20', endDate: '2024-12-26', minNights: 1, bookings: 148, revenue: 740000,  createdAt: '2024-12-12' },
  { id: 'PR-010', name: 'Sofitel New Year Package',     merchantId: 'MCH-0005', merchantName: 'Sofitel Guangzhou',           promotionType: 'package',    discountValue: 0,  discountDisplay: 'NY Package',    status: 'scheduled', startDate: '2024-12-31', endDate: '2025-01-02', minNights: 2, bookings: 0,   revenue: 0,       createdAt: '2024-12-14' },
]

// ─── Welcome Rewards ──────────────────────────────────────────────────────────────────────────────
export interface WelcomeReward {
  id: string
  name: string
  rewardType: 'new_user' | 'first_booking' | 'registration'
  discountType: 'percentage' | 'fixed' | 'free_night' | 'cashback'
  discountValue: number
  discountDisplay: string
  status: 'active' | 'paused' | 'draft'
  validityDays: number
  usageLimit: number
  usageCount: number
  minSpend: number
  newUsersConverted: number
  revenue: number
  createdAt: string
}

export const welcomeRewards: WelcomeReward[] = [
  { id: 'WR-001', name: 'New User Welcome Voucher',      rewardType: 'new_user',       discountType: 'fixed',      discountValue: 100, discountDisplay: 'MMK 100 OFF', status: 'active', validityDays: 30,  usageLimit: 50000, usageCount: 38240, minSpend: 400,  newUsersConverted: 28680, revenue: 11472000, createdAt: '2024-01-01' },
  { id: 'WR-002', name: 'First Booking Discount',        rewardType: 'first_booking',  discountType: 'percentage', discountValue: 15,  discountDisplay: '15% OFF',     status: 'active', validityDays: 14,  usageLimit: 30000, usageCount: 22480, minSpend: 200,  newUsersConverted: 18640, revenue: 8640000,  createdAt: '2024-01-01' },
  { id: 'WR-003', name: 'Registration Cashback Reward',  rewardType: 'registration',   discountType: 'cashback',   discountValue: 5,   discountDisplay: '5% Cashback', status: 'active', validityDays: 60,  usageLimit: 20000, usageCount: 14800, minSpend: 300,  newUsersConverted: 12200, revenue: 4880000,  createdAt: '2024-03-15' },
  { id: 'WR-004', name: 'Premium New User Reward',       rewardType: 'new_user',       discountType: 'free_night', discountValue: 1,   discountDisplay: 'Free Night',  status: 'paused', validityDays: 30,  usageLimit: 5000,  usageCount: 2840,  minSpend: 800,  newUsersConverted: 2840,  revenue: 3124000,  createdAt: '2024-06-01' },
  { id: 'WR-005', name: 'App Download First Booking',    rewardType: 'first_booking',  discountType: 'fixed',      discountValue: 50,  discountDisplay: 'MMK 50 OFF',  status: 'draft',  validityDays: 7,   usageLimit: 10000, usageCount: 0,     minSpend: 150,  newUsersConverted: 0,     revenue: 0,        createdAt: '2024-12-10' },
]

// ─── Platform Summary Stats ────────────────────────────────────────────────
export const platformStats = {
  totalMerchants: 30,
  pendingVerification: merchants.filter(m => m.verificationStatus === 'pending').length,
  approvedMerchants: merchants.filter(m => m.verificationStatus === 'approved').length,
  suspendedMerchants: merchants.filter(m => m.status === 'suspended').length,
  todayBookings: 142,
  pendingRefunds: bookings.filter(b => b.refundStatus === 'requested').length,
  pendingSettlements: bookings.filter(b => b.settlementStatus === 'pending').length,
  platformRevenueMTD: 48312400,
  affiliateCommissionMTD: 1240000,
  activeCampaigns: campaigns.filter(c => c.status === 'active').length,
}

// ─── Affiliate Codes ────────────────────────────────────────────────────────
export interface AffiliateCode {
  id: string
  code: string
  affiliateId: string
  affiliateName: string
  affiliateHandle: string
  affiliateType: 'influencer' | 'blogger' | 'kol' | 'ota_partner' | 'corporate'
  promotionType: 'percentage' | 'fixed' | 'free_night' | 'cashback'
  discountValue: number
  discountDisplay: string
  referralLink: string
  status: 'active' | 'paused' | 'expired' | 'draft'
  startDate: string
  endDate: string
  usageLimit: number
  usageCount: number
  perUserLimit: number
  eligibleMerchants: 'all' | 'selected'
  merchantCount: number
  bookings: number
  conversions: number
  revenue: number
  commission: number
  commissionRate: number
  lastUsed?: string
  createdBy: string
  createdAt: string
}

export const affiliateCodes: AffiliateCode[] = [
  { id: 'AC-001', code: 'LILY20',   affiliateId: 'AFF-001', affiliateName: 'TravelWithLily',     affiliateHandle: '@travelwithlily',   affiliateType: 'influencer',  promotionType: 'percentage', discountValue: 20,  discountDisplay: '20% OFF',     referralLink: 'https://mtrip.com/r/lily20',   status: 'active',  startDate: '2024-10-01', endDate: '2025-03-31', usageLimit: 5000,  usageCount: 3847, perUserLimit: 3, eligibleMerchants: 'all',      merchantCount: 30, bookings: 1820, conversions: 1456, revenue: 4368000, commission: 218400, commissionRate: 5,   lastUsed: '2024-12-15', createdBy: 'Admin Chen', createdAt: '2024-09-28' },
  { id: 'AC-002', code: 'JASON15',  affiliateId: 'AFF-002', affiliateName: 'Jason Hotel Reviews', affiliateHandle: '@jasonhotels',      affiliateType: 'kol',         promotionType: 'percentage', discountValue: 15,  discountDisplay: '15% OFF',     referralLink: 'https://mtrip.com/r/jason15',  status: 'active',  startDate: '2024-09-01', endDate: '2025-02-28', usageLimit: 3000,  usageCount: 2140, perUserLimit: 2, eligibleMerchants: 'selected', merchantCount: 15, bookings: 1020, conversions: 918,  revenue: 2754000, commission: 137700, commissionRate: 5,   lastUsed: '2024-12-15', createdBy: 'Admin Zhang', createdAt: '2024-08-25' },
  { id: 'AC-003', code: 'LUX22',    affiliateId: 'AFF-004', affiliateName: 'LuxuryHotelSeeker',  affiliateHandle: '@luxhotelseeker',   affiliateType: 'influencer',  promotionType: 'fixed',      discountValue: 220, discountDisplay: '¥220 OFF',     referralLink: 'https://mtrip.com/r/lux22',    status: 'active',  startDate: '2024-11-01', endDate: '2025-06-30', usageLimit: 2000,  usageCount: 882,  perUserLimit: 2, eligibleMerchants: 'selected', merchantCount: 8,  bookings: 441,  conversions: 394,  revenue: 1970000, commission: 157600, commissionRate: 8,   lastUsed: '2024-12-14', createdBy: 'Admin Li',   createdAt: '2024-10-28' },
  { id: 'AC-004', code: 'RESORT10', affiliateId: 'AFF-005', affiliateName: 'ResortFinder_CN',    affiliateHandle: '@resortfindercn',   affiliateType: 'kol',         promotionType: 'percentage', discountValue: 10,  discountDisplay: '10% OFF',     referralLink: 'https://mtrip.com/r/resort10', status: 'active',  startDate: '2024-08-01', endDate: '2025-07-31', usageLimit: 4000,  usageCount: 2610, perUserLimit: 3, eligibleMerchants: 'selected', merchantCount: 12, bookings: 1200, conversions: 1020, revenue: 1836000, commission: 110160, commissionRate: 6,   lastUsed: '2024-12-13', createdBy: 'Admin Chen', createdAt: '2024-07-28' },
  { id: 'AC-005', code: 'WANDER18', affiliateId: 'AFF-006', affiliateName: 'WanderLust_Asia',    affiliateHandle: '@wanderlust_asia',  affiliateType: 'influencer',  promotionType: 'percentage', discountValue: 18,  discountDisplay: '18% OFF',     referralLink: 'https://mtrip.com/r/wander18', status: 'active',  startDate: '2024-07-01', endDate: '2025-01-31', usageLimit: 3500,  usageCount: 2980, perUserLimit: 2, eligibleMerchants: 'all',      merchantCount: 30, bookings: 1490, conversions: 1192, revenue: 2384000, commission: 166880, commissionRate: 7,   lastUsed: '2024-12-15', createdBy: 'Admin Zhang', createdAt: '2024-06-28' },
  { id: 'AC-006', code: 'ASIADEAL', affiliateId: 'AFF-007', affiliateName: 'AsiaHotelDeals',     affiliateHandle: '@asiahoteldeals',   affiliateType: 'ota_partner', promotionType: 'fixed',      discountValue: 150, discountDisplay: '¥150 OFF',     referralLink: 'https://mtrip.com/r/asiadeal',  status: 'active',  startDate: '2024-06-01', endDate: '2025-05-31', usageLimit: 10000, usageCount: 7840, perUserLimit: 5, eligibleMerchants: 'all',      merchantCount: 30, bookings: 3920, conversions: 3528, revenue: 7056000, commission: 352800, commissionRate: 5,   lastUsed: '2024-12-15', createdBy: 'Admin Li',   createdAt: '2024-05-28' },
  { id: 'AC-007', code: 'URBAN12',  affiliateId: 'AFF-008', affiliateName: 'UrbanTraveler_SH',   affiliateHandle: '@urbantraveler_sh', affiliateType: 'blogger',     promotionType: 'percentage', discountValue: 12,  discountDisplay: '12% OFF',     referralLink: 'https://mtrip.com/r/urban12',  status: 'active',  startDate: '2024-09-15', endDate: '2025-03-15', usageLimit: 2500,  usageCount: 1420, perUserLimit: 2, eligibleMerchants: 'selected', merchantCount: 10, bookings: 680,  conversions: 578,  revenue: 867000,  commission: 43350,  commissionRate: 5,   lastUsed: '2024-12-14', createdBy: 'Admin Chen', createdAt: '2024-09-10' },
  { id: 'AC-008', code: 'CORP5',    affiliateId: 'AFF-009', affiliateName: 'Corporate Travel Pro',affiliateHandle: '@corptravel_pro',  affiliateType: 'corporate',   promotionType: 'cashback',   discountValue: 5,   discountDisplay: '5% Cashback', referralLink: 'https://mtrip.com/r/corp5',    status: 'active',  startDate: '2024-01-01', endDate: '2024-12-31', usageLimit: 20000, usageCount: 16820,perUserLimit: 99,eligibleMerchants: 'all',      merchantCount: 30, bookings: 8410, conversions: 8074, revenue: 14533200,commission: 435996, commissionRate: 3,   lastUsed: '2024-12-15', createdBy: 'Admin Zhang', createdAt: '2023-12-20' },
  { id: 'AC-009', code: 'SUITE25',  affiliateId: 'AFF-010', affiliateName: 'SuiteLife_CN',       affiliateHandle: '@suitelife_cn',    affiliateType: 'influencer',  promotionType: 'percentage', discountValue: 25,  discountDisplay: '25% OFF',     referralLink: 'https://mtrip.com/r/suite25',  status: 'paused',  startDate: '2024-10-15', endDate: '2025-04-15', usageLimit: 1500,  usageCount: 644,  perUserLimit: 2, eligibleMerchants: 'selected', merchantCount: 6,  bookings: 322,  conversions: 258,  revenue: 1032000, commission: 92880,  commissionRate: 9,   lastUsed: '2024-12-10', createdBy: 'Admin Li',   createdAt: '2024-10-12' },
  { id: 'AC-010', code: 'SH15',     affiliateId: 'AFF-012', affiliateName: 'ShanghaiLifestyle',  affiliateHandle: '@shanghailifestyle',affiliateType: 'kol',         promotionType: 'percentage', discountValue: 15,  discountDisplay: '15% OFF',     referralLink: 'https://mtrip.com/r/sh15',     status: 'active',  startDate: '2024-11-01', endDate: '2025-04-30', usageLimit: 3000,  usageCount: 1880, perUserLimit: 2, eligibleMerchants: 'selected', merchantCount: 8,  bookings: 890,  conversions: 712,  revenue: 1424000, commission: 85440,  commissionRate: 6,   lastUsed: '2024-12-15', createdBy: 'Admin Chen', createdAt: '2024-10-28' },
  { id: 'AC-011', code: 'MIKE18',   affiliateId: 'AFF-014', affiliateName: 'CityHopperMike',     affiliateHandle: '@cityhoppermike',  affiliateType: 'influencer',  promotionType: 'percentage', discountValue: 18,  discountDisplay: '18% OFF',     referralLink: 'https://mtrip.com/r/mike18',   status: 'active',  startDate: '2024-08-20', endDate: '2025-02-20', usageLimit: 4000,  usageCount: 2210, perUserLimit: 3, eligibleMerchants: 'all',      merchantCount: 30, bookings: 1050, conversions: 840,  revenue: 2520000, commission: 176400, commissionRate: 7,   lastUsed: '2024-12-14', createdBy: 'Admin Zhang', createdAt: '2024-08-15' },
  { id: 'AC-012', code: 'MOM8',     affiliateId: 'AFF-015', affiliateName: 'TravelWithMom',      affiliateHandle: '@travelwithmom_cn',affiliateType: 'blogger',     promotionType: 'fixed',      discountValue: 80,  discountDisplay: '¥80 OFF',      referralLink: 'https://mtrip.com/r/mom8',     status: 'active',  startDate: '2024-09-01', endDate: '2025-08-31', usageLimit: 5000,  usageCount: 3120, perUserLimit: 4, eligibleMerchants: 'all',      merchantCount: 30, bookings: 1440, conversions: 1008, revenue: 1512000, commission: 75600,  commissionRate: 5,   lastUsed: '2024-12-15', createdBy: 'Admin Li',   createdAt: '2024-08-28' },
  { id: 'AC-013', code: 'INSIDER',  affiliateId: 'AFF-016', affiliateName: 'HotelInsiderCN',     affiliateHandle: '@hotelinsidercn',  affiliateType: 'kol',         promotionType: 'free_night', discountValue: 1,   discountDisplay: 'Free Night',  referralLink: 'https://mtrip.com/r/insider',  status: 'active',  startDate: '2024-10-01', endDate: '2025-09-30', usageLimit: 1000,  usageCount: 418,  perUserLimit: 1, eligibleMerchants: 'selected', merchantCount: 5,  bookings: 209,  conversions: 188,  revenue: 940000,  commission: 56400,  commissionRate: 6,   lastUsed: '2024-12-13', createdBy: 'Admin Chen', createdAt: '2024-09-28' },
  { id: 'AC-014', code: 'NOMAD12',  affiliateId: 'AFF-019', affiliateName: 'GlobalNomadTV',      affiliateHandle: '@globalnomadtv',   affiliateType: 'influencer',  promotionType: 'percentage', discountValue: 12,  discountDisplay: '12% OFF',     referralLink: 'https://mtrip.com/r/nomad12',  status: 'active',  startDate: '2024-07-15', endDate: '2025-07-15', usageLimit: 6000,  usageCount: 3488, perUserLimit: 3, eligibleMerchants: 'all',      merchantCount: 30, bookings: 1660, conversions: 1328, revenue: 2921600, commission: 204512, commissionRate: 7,   lastUsed: '2024-12-14', createdBy: 'Admin Zhang', createdAt: '2024-07-10' },
  { id: 'AC-015', code: 'TNOW',     affiliateId: 'AFF-020', affiliateName: 'TravelNowCorp',      affiliateHandle: '@travelnowcorp',   affiliateType: 'ota_partner', promotionType: 'fixed',      discountValue: 200, discountDisplay: '¥200 OFF',     referralLink: 'https://mtrip.com/r/tnow',     status: 'active',  startDate: '2024-01-01', endDate: '2025-12-31', usageLimit: 50000, usageCount: 41200,perUserLimit: 10,eligibleMerchants: 'all',      merchantCount: 30, bookings: 20600,conversions: 18540,revenue: 37080000,commission: 1112400,commissionRate: 3,  lastUsed: '2024-12-15', createdBy: 'Admin Li',   createdAt: '2023-12-28' },
  { id: 'AC-016', code: 'SLEEP10',  affiliateId: 'AFF-017', affiliateName: 'SleepWellGuide',     affiliateHandle: '@sleepwellguide',  affiliateType: 'blogger',     promotionType: 'percentage', discountValue: 10,  discountDisplay: '10% OFF',     referralLink: 'https://mtrip.com/r/sleep10',  status: 'draft',   startDate: '2025-01-01', endDate: '2025-06-30', usageLimit: 2000,  usageCount: 0,    perUserLimit: 2, eligibleMerchants: 'all',      merchantCount: 30, bookings: 0,    conversions: 0,    revenue: 0,       commission: 0,      commissionRate: 5,   createdBy: 'Admin Chen', createdAt: '2024-12-12' },
  { id: 'AC-017', code: 'CHINA5',   affiliateId: 'AFF-003', affiliateName: 'ChinaTravelBlog',    affiliateHandle: '@chinatravelblog',  affiliateType: 'blogger',     promotionType: 'cashback',   discountValue: 5,   discountDisplay: '5% Cashback', referralLink: 'https://mtrip.com/r/china5',   status: 'expired', startDate: '2024-01-01', endDate: '2024-06-30', usageLimit: 3000,  usageCount: 2980, perUserLimit: 3, eligibleMerchants: 'all',      merchantCount: 30, bookings: 1440, conversions: 1152, revenue: 1843200, commission: 92160,  commissionRate: 5,   lastUsed: '2024-06-30', createdBy: 'Admin Zhang', createdAt: '2023-12-28' },
  { id: 'AC-018', code: 'BUDGET8',  affiliateId: 'AFF-013', affiliateName: 'BudgetTraveler_Asia',affiliateHandle: '@budgettraveler_asia',affiliateType: 'blogger',  promotionType: 'percentage', discountValue: 8,   discountDisplay: '8% OFF',      referralLink: 'https://mtrip.com/r/budget8',  status: 'paused',  startDate: '2024-11-01', endDate: '2025-04-30', usageLimit: 3000,  usageCount: 420,  perUserLimit: 2, eligibleMerchants: 'all',      merchantCount: 30, bookings: 200,  conversions: 120,  revenue: 180000,  commission: 9000,   commissionRate: 5,   lastUsed: '2024-12-05', createdBy: 'Admin Li',   createdAt: '2024-10-28' },
]
