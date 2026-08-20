import { useState, useEffect } from 'react'
import type React from 'react'
import {
  Search, Download, Printer, Eye, Calendar, Receipt, RotateCcw, Gift, Tag, Ticket,
  CreditCard, Bookmark, ArrowDownCircle, ArrowUpCircle, Star, Mail, Phone, Globe,
  CheckCircle, Clock, Filter, Copy, ChevronLeft, ChevronRight, XCircle,
} from 'lucide-react'
import Drawer from '../components/Drawer'

// ─── Types ────────────────────────────────────────────────────────────────────

type MemberTier = 'Bronze' | 'Silver' | 'Gold' | 'Platinum'
type UserStatus = 'active' | 'suspended' | 'blacklisted' | 'inactive'

interface EndUser {
  id: string; name: string; email: string; phone: string; country: string
  totalBookings: number; totalSpending: number; tier: MemberTier
  registeredAt: string; status: UserStatus; avatar: string
  lastLogin: string; points: number
}

type TransactionType =
  | 'Booking Payment' | 'Refund' | 'Reward Credit' | 'Reward Redemption'
  | 'Coupon Redemption' | 'Voucher Redemption' | 'Wallet Credit' | 'Wallet Debit'

type TransactionStatus = 'Pending' | 'Completed' | 'Failed' | 'Refunded' | 'Cancelled'

type PaymentMethod =
  | 'Credit/Debit Card' | 'KBZPay' | 'Wave Pay' | 'Bank Transfer' | 'Reward Wallet' | 'Other'

interface TxTimeline { label: string; time: string; done: boolean }

interface Transaction {
  id: string; bookingId?: string; type: TransactionType; description: string
  amount: number; unit: 'MMK' | 'pts'; paymentMethod: PaymentMethod
  status: TransactionStatus; timestamp: string; paymentReference?: string
  hotelName?: string; roomType?: string; guestName?: string; processingTime?: string
  rewardCreditsEarned?: number; rewardCreditsRedeemed?: number
  couponApplied?: string; voucherUsed?: string
  refundAmount?: number; refundStatus?: string; refundDate?: string; refundReason?: string
  timeline: TxTimeline[]
}

interface Props {
  showToast: (type: 'success' | 'error' | 'warning' | 'info', title: string, message: string) => void
  user?: EndUser
}

// ─── User Database ────────────────────────────────────────────────────────────

// ─── Transaction Data ─────────────────────────────────────────────────────────

const ZAR_NI_TRANSACTIONS: Transaction[] = [
  {
    id: 'TXN-KBZ-20241210-9912', bookingId: 'BKG-9912', type: 'Booking Payment',
    description: 'The Strand Hotel Yangon — Superior Room, Dec 12–14', amount: 520000, unit: 'MMK',
    paymentMethod: 'KBZPay', status: 'Completed', timestamp: '2024-12-10 14:22',
    paymentReference: 'KBZ-REF-20241210-001', hotelName: 'The Strand Hotel Yangon',
    roomType: 'Superior Room', guestName: 'Zar Ni', processingTime: '1.9s', rewardCreditsEarned: 520,
    timeline: [
      { label: 'Payment Initiated', time: '2024-12-10 14:20', done: true },
      { label: 'Payment Completed', time: '2024-12-10 14:22', done: true },
      { label: 'Booking Confirmed', time: '2024-12-10 14:23', done: true },
      { label: 'Reward Credited', time: '2024-12-14 12:00', done: false },
    ],
  },
  {
    id: 'CPN-20241210-9912', bookingId: 'BKG-9912', type: 'Coupon Redemption',
    description: 'GOLD15 coupon — 15% Gold member discount', amount: 78000, unit: 'MMK',
    paymentMethod: 'Reward Wallet', status: 'Completed', timestamp: '2024-12-10 14:20',
    couponApplied: 'GOLD15',
    timeline: [
      { label: 'Coupon Validated', time: '2024-12-10 14:20', done: true },
      { label: 'Discount Applied', time: '2024-12-10 14:20', done: true },
    ],
  },
  {
    id: 'TXN-WP-20241105-9344', bookingId: 'BKG-9344', type: 'Booking Payment',
    description: 'Chatrium Riverside Hotel — Deluxe River View, Nov 8–10', amount: 380000, unit: 'MMK',
    paymentMethod: 'Wave Pay', status: 'Completed', timestamp: '2024-11-05 10:18',
    paymentReference: 'WP-REF-20241105-002', hotelName: 'Chatrium Riverside Hotel',
    roomType: 'Deluxe River View', guestName: 'Zar Ni', processingTime: '2.1s', rewardCreditsEarned: 380,
    timeline: [
      { label: 'Payment Initiated', time: '2024-11-05 10:16', done: true },
      { label: 'Payment Completed', time: '2024-11-05 10:18', done: true },
      { label: 'Booking Confirmed', time: '2024-11-05 10:19', done: true },
      { label: 'Reward Credited', time: '2024-11-10 12:00', done: true },
    ],
  },
  {
    id: 'RWD-20241110-9344', bookingId: 'BKG-9344', type: 'Reward Credit',
    description: '380 pts earned — Chatrium Riverside stay completed', amount: 380, unit: 'pts',
    paymentMethod: 'Reward Wallet', status: 'Completed', timestamp: '2024-11-10 12:00',
    rewardCreditsEarned: 380,
    timeline: [
      { label: 'Stay Completed', time: '2024-11-10 11:00', done: true },
      { label: 'Points Credited', time: '2024-11-10 12:00', done: true },
    ],
  },
  {
    id: 'VCH-20241002-8860', bookingId: 'BKG-8860', type: 'Voucher Redemption',
    description: 'Gold anniversary voucher applied — Novotel Inle Lake', amount: 30000, unit: 'MMK',
    paymentMethod: 'Reward Wallet', status: 'Completed', timestamp: '2024-10-02 19:44',
    voucherUsed: 'VOC-GOLD-ANNIV-2024', hotelName: 'Novotel Inle Lake Resort',
    timeline: [
      { label: 'Voucher Validated', time: '2024-10-02 19:44', done: true },
      { label: 'Discount Applied', time: '2024-10-02 19:44', done: true },
    ],
  },
  {
    id: 'TXN-CC-20241002-8860', bookingId: 'BKG-8860', type: 'Booking Payment',
    description: 'Novotel Inle Lake Resort — Lake View Room, Oct 5–7', amount: 420000, unit: 'MMK',
    paymentMethod: 'Credit/Debit Card', status: 'Completed', timestamp: '2024-10-02 19:46',
    paymentReference: 'CC-REF-20241002-003', hotelName: 'Novotel Inle Lake Resort',
    roomType: 'Lake View Room', guestName: 'Zar Ni', processingTime: '1.4s', rewardCreditsEarned: 420,
    voucherUsed: 'VOC-GOLD-ANNIV-2024',
    timeline: [
      { label: 'Payment Initiated', time: '2024-10-02 19:44', done: true },
      { label: 'Payment Completed', time: '2024-10-02 19:46', done: true },
      { label: 'Booking Confirmed', time: '2024-10-02 19:47', done: true },
      { label: 'Reward Credited', time: '2024-10-07 11:00', done: true },
    ],
  },
  {
    id: 'RWD-20241007-8860', bookingId: 'BKG-8860', type: 'Reward Credit',
    description: '420 pts earned — Inle Lake stay completed', amount: 420, unit: 'pts',
    paymentMethod: 'Reward Wallet', status: 'Completed', timestamp: '2024-10-07 11:00',
    rewardCreditsEarned: 420,
    timeline: [
      { label: 'Stay Completed', time: '2024-10-07 10:00', done: true },
      { label: 'Points Credited', time: '2024-10-07 11:00', done: true },
    ],
  },
  {
    id: 'TXN-REF-20240820-7501', bookingId: 'BKG-7501', type: 'Refund',
    description: 'Full refund — Mandalay Hill Resort cancellation', amount: 290000, unit: 'MMK',
    paymentMethod: 'KBZPay', status: 'Completed', timestamp: '2024-08-20 09:30',
    paymentReference: 'REF-20240815-501', hotelName: 'Mandalay Hill Resort',
    guestName: 'Zar Ni', refundAmount: 290000, refundStatus: 'Processed',
    refundDate: '2024-08-20', refundReason: 'Booking cancellation — free cancellation period',
    timeline: [
      { label: 'Refund Requested', time: '2024-08-15 16:10', done: true },
      { label: 'Refund Approved', time: '2024-08-16 09:00', done: true },
      { label: 'Refund Processed', time: '2024-08-20 09:30', done: true },
    ],
  },
  {
    id: 'RDP-20240612-REW', type: 'Reward Redemption',
    description: '500 pts redeemed — MMK 5,000 discount on Aureum Palace booking', amount: 500, unit: 'pts',
    paymentMethod: 'Reward Wallet', status: 'Completed', timestamp: '2024-06-12 11:05',
    rewardCreditsRedeemed: 500,
    timeline: [
      { label: 'Redemption Requested', time: '2024-06-12 11:05', done: true },
      { label: 'Points Deducted', time: '2024-06-12 11:05', done: true },
      { label: 'Discount Applied', time: '2024-06-12 11:05', done: true },
    ],
  },
  {
    id: 'WLT-20240501-TIER', type: 'Wallet Credit',
    description: 'Gold tier upgrade bonus — MMK 5,000 wallet credit', amount: 5000, unit: 'MMK',
    paymentMethod: 'Reward Wallet', status: 'Completed', timestamp: '2024-05-01 09:00',
    timeline: [
      { label: 'Tier Upgraded to Gold', time: '2024-05-01 09:00', done: true },
      { label: 'Bonus Credit Applied', time: '2024-05-01 09:00', done: true },
    ],
  },
]

const WEI_LIN_TRANSACTIONS: Transaction[] = [
  {
    id: 'TXN-WP-20241205-8821', bookingId: 'BKG-8821', type: 'Booking Payment',
    description: 'Sedona Hotel Yangon — Deluxe Room, Dec 6–8', amount: 480000, unit: 'MMK',
    paymentMethod: 'Wave Pay', status: 'Completed', timestamp: '2024-12-05 11:32',
    paymentReference: 'WP-REF-20241205-001', hotelName: 'Sedona Hotel Yangon', roomType: 'Deluxe Room',
    guestName: 'Wei Lin', processingTime: '2.1s', rewardCreditsEarned: 480, couponApplied: 'WINTER20 (–20%)',
    timeline: [
      { label: 'Payment Initiated', time: '2024-12-05 11:30', done: true },
      { label: 'Payment Completed', time: '2024-12-05 11:32', done: true },
      { label: 'Booking Confirmed', time: '2024-12-05 11:33', done: true },
      { label: 'Reward Credited', time: '—', done: false },
    ],
  },
  {
    id: 'CPN-20241205-8821', bookingId: 'BKG-8821', type: 'Coupon Redemption',
    description: 'WINTER20 coupon applied — 20% discount', amount: 120000, unit: 'MMK',
    paymentMethod: 'Reward Wallet', status: 'Completed', timestamp: '2024-12-05 11:30',
    couponApplied: 'WINTER20',
    timeline: [
      { label: 'Coupon Validated', time: '2024-12-05 11:30', done: true },
      { label: 'Discount Applied', time: '2024-12-05 11:30', done: true },
    ],
  },
  {
    id: 'RWD-20241208-8821', bookingId: 'BKG-8821', type: 'Reward Credit',
    description: '480 pts earned — Sedona Hotel stay completed', amount: 480, unit: 'pts',
    paymentMethod: 'Reward Wallet', status: 'Completed', timestamp: '2024-12-08 12:05',
    rewardCreditsEarned: 480,
    timeline: [
      { label: 'Stay Completed', time: '2024-12-08 12:00', done: true },
      { label: 'Points Credited', time: '2024-12-08 12:05', done: true },
    ],
  },
  {
    id: 'TXN-KBZ-20241114-8640', bookingId: 'BKG-8640', type: 'Booking Payment',
    description: 'Novotel Inle Lake Resort — Lake View Suite, Nov 25–28', amount: 960000, unit: 'MMK',
    paymentMethod: 'KBZPay', status: 'Completed', timestamp: '2024-11-14 20:20',
    paymentReference: 'KBZ-REF-20241114-002', hotelName: 'Novotel Inle Lake Resort',
    roomType: 'Lake View Suite', guestName: 'Wei Lin', processingTime: '1.8s',
    rewardCreditsEarned: 960, voucherUsed: 'VOC-HOLIDAY-2024',
    timeline: [
      { label: 'Payment Initiated', time: '2024-11-14 20:18', done: true },
      { label: 'Payment Completed', time: '2024-11-14 20:20', done: true },
      { label: 'Booking Confirmed', time: '2024-11-14 20:21', done: true },
      { label: 'Refund Processed', time: '—', done: false },
    ],
  },
  {
    id: 'RWD-20241128-8640', bookingId: 'BKG-8640', type: 'Reward Credit',
    description: '960 pts earned — Inle Lake stay (2× destination bonus)', amount: 960, unit: 'pts',
    paymentMethod: 'Reward Wallet', status: 'Completed', timestamp: '2024-11-28 11:05',
    rewardCreditsEarned: 960,
    timeline: [
      { label: 'Stay Completed', time: '2024-11-28 11:00', done: true },
      { label: 'Points Credited', time: '2024-11-28 11:05', done: true },
    ],
  },
  {
    id: 'TXN-REF-20240722-7210', bookingId: 'BKG-7210', type: 'Refund',
    description: "Full refund — Governor's Residence cancellation", amount: 290000, unit: 'MMK',
    paymentMethod: 'Wave Pay', status: 'Completed', timestamp: '2024-07-22 10:00',
    paymentReference: 'REF-20240717-210', hotelName: "Governor's Residence Hotel",
    guestName: 'Wei Lin', refundAmount: 290000, refundStatus: 'Processed',
    refundDate: '2024-07-22', refundReason: 'Booking cancellation — free cancellation policy',
    timeline: [
      { label: 'Refund Requested', time: '2024-07-17 14:02', done: true },
      { label: 'Refund Approved', time: '2024-07-18 09:00', done: true },
      { label: 'Refund Processed', time: '2024-07-22 10:00', done: true },
    ],
  },
  {
    id: 'TXN-CC-20240320-5100', bookingId: 'BKG-5100', type: 'Booking Payment',
    description: 'The Strand Hotel Yangon — Superior Room, Mar 22–24', amount: 520000, unit: 'MMK',
    paymentMethod: 'Credit/Debit Card', status: 'Completed', timestamp: '2024-03-20 15:30',
    paymentReference: 'CC-REF-20240320-005', hotelName: 'The Strand Hotel Yangon',
    roomType: 'Superior Room', guestName: 'Wei Lin', processingTime: '1.2s', rewardCreditsEarned: 520,
    timeline: [
      { label: 'Payment Initiated', time: '2024-03-20 15:29', done: true },
      { label: 'Payment Completed', time: '2024-03-20 15:30', done: true },
      { label: 'Booking Confirmed', time: '2024-03-20 15:31', done: true },
      { label: 'Reward Credited', time: '—', done: false },
    ],
  },
  {
    id: 'WLT-20240801-GOLD', type: 'Wallet Credit',
    description: 'Platinum tier upgrade bonus — MMK 10,000 wallet credit', amount: 10000, unit: 'MMK',
    paymentMethod: 'Reward Wallet', status: 'Completed', timestamp: '2024-08-01 09:00',
    timeline: [
      { label: 'Tier Upgraded', time: '2024-08-01 09:00', done: true },
      { label: 'Credit Applied', time: '2024-08-01 09:00', done: true },
    ],
  },
  {
    id: 'RDP-20240805-8210', bookingId: 'BKG-8210', type: 'Reward Redemption',
    description: '500 pts redeemed — MMK 5,000 discount on booking', amount: 500, unit: 'pts',
    paymentMethod: 'Reward Wallet', status: 'Completed', timestamp: '2024-08-05 15:20',
    rewardCreditsRedeemed: 500,
    timeline: [
      { label: 'Redemption Requested', time: '2024-08-05 15:20', done: true },
      { label: 'Points Deducted', time: '2024-08-05 15:20', done: true },
      { label: 'Discount Applied', time: '2024-08-05 15:20', done: true },
    ],
  },
  {
    id: 'TXN-FAIL-20240715', type: 'Booking Payment', description: "Governor's Residence — payment attempt failed",
    amount: 290000, unit: 'MMK', paymentMethod: 'KBZPay', status: 'Failed', timestamp: '2024-07-15 16:40',
    paymentReference: 'KBZ-FAIL-20240715-001', processingTime: '8.3s',
    timeline: [
      { label: 'Payment Initiated', time: '2024-07-15 16:40', done: true },
      { label: 'Payment Failed', time: '2024-07-15 16:40', done: true },
    ],
  },
]

const AYE_MYAT_TRANSACTIONS: Transaction[] = [
  {
    id: 'TXN-KBZ-20241201-8800', bookingId: 'BKG-8800', type: 'Booking Payment',
    description: 'Sedona Hotel Yangon — Standard Room, Dec 3–5', amount: 320000, unit: 'MMK',
    paymentMethod: 'KBZPay', status: 'Completed', timestamp: '2024-12-01 09:40',
    paymentReference: 'KBZ-REF-20241201-001', hotelName: 'Sedona Hotel Yangon',
    roomType: 'Standard Room', guestName: 'Aye Myat Thu', processingTime: '1.7s', rewardCreditsEarned: 320,
    timeline: [
      { label: 'Payment Initiated', time: '2024-12-01 09:38', done: true },
      { label: 'Payment Completed', time: '2024-12-01 09:40', done: true },
      { label: 'Booking Confirmed', time: '2024-12-01 09:41', done: true },
    ],
  },
  {
    id: 'RWD-20241205-8800', bookingId: 'BKG-8800', type: 'Reward Credit',
    description: '320 pts earned — Sedona Hotel stay', amount: 320, unit: 'pts',
    paymentMethod: 'Reward Wallet', status: 'Completed', timestamp: '2024-12-05 11:00',
    rewardCreditsEarned: 320,
    timeline: [
      { label: 'Stay Completed', time: '2024-12-05 10:00', done: true },
      { label: 'Points Credited', time: '2024-12-05 11:00', done: true },
    ],
  },
  {
    id: 'TXN-WP-20241005-8200', bookingId: 'BKG-8200', type: 'Booking Payment',
    description: 'Aureum Palace Naypyidaw — Deluxe Room, Oct 8–9', amount: 185000, unit: 'MMK',
    paymentMethod: 'Wave Pay', status: 'Pending', timestamp: '2024-10-05 15:00',
    paymentReference: 'WP-REF-20241005-002', hotelName: 'Aureum Palace Hotel',
    roomType: 'Deluxe Room', guestName: 'Aye Myat Thu', processingTime: '—',
    timeline: [
      { label: 'Payment Initiated', time: '2024-10-05 15:00', done: true },
      { label: 'Payment Completed', time: '—', done: false },
      { label: 'Booking Confirmed', time: '—', done: false },
    ],
  },
]

const KYAW_ZIN_TRANSACTIONS: Transaction[] = [
  {
    id: 'TXN-KBZ-20241001-7700', bookingId: 'BKG-7700', type: 'Booking Payment',
    description: 'Novotel Yangon Max — Standard Room, Oct 5–6', amount: 120000, unit: 'MMK',
    paymentMethod: 'KBZPay', status: 'Completed', timestamp: '2024-10-01 11:00',
    paymentReference: 'KBZ-REF-20241001-001', hotelName: 'Novotel Yangon Max',
    roomType: 'Standard Room', guestName: 'Kyaw Zin Thant', processingTime: '2.0s',
    timeline: [
      { label: 'Payment Initiated', time: '2024-10-01 11:00', done: true },
      { label: 'Payment Completed', time: '2024-10-01 11:00', done: true },
      { label: 'Booking Confirmed', time: '2024-10-01 11:01', done: true },
    ],
  },
  {
    id: 'TXN-SUSP-20241030', type: 'Wallet Debit',
    description: 'Admin suspension — account policy violation deduction', amount: 5000, unit: 'MMK',
    paymentMethod: 'Reward Wallet', status: 'Completed', timestamp: '2024-10-30 09:00',
    timeline: [
      { label: 'Suspension Initiated', time: '2024-10-30 09:00', done: true },
      { label: 'Balance Adjusted', time: '2024-10-30 09:00', done: true },
    ],
  },
]

const SU_SU_TRANSACTIONS: Transaction[] = [
  {
    id: 'TXN-WP-20240901-8100', bookingId: 'BKG-8100', type: 'Booking Payment',
    description: 'Chatrium Riverside — Deluxe Room, Sep 5–7', amount: 360000, unit: 'MMK',
    paymentMethod: 'Wave Pay', status: 'Completed', timestamp: '2024-09-01 14:30',
    paymentReference: 'WP-REF-20240901-001', hotelName: 'Chatrium Riverside Hotel',
    roomType: 'Deluxe Room', guestName: 'Su Su Htwe', processingTime: '1.5s', rewardCreditsEarned: 360,
    timeline: [
      { label: 'Payment Initiated', time: '2024-09-01 14:28', done: true },
      { label: 'Payment Completed', time: '2024-09-01 14:30', done: true },
      { label: 'Booking Confirmed', time: '2024-09-01 14:31', done: true },
    ],
  },
  {
    id: 'RWD-20240907-8100', type: 'Reward Credit',
    description: '360 pts earned — Chatrium Riverside stay', amount: 360, unit: 'pts',
    paymentMethod: 'Reward Wallet', status: 'Completed', timestamp: '2024-09-07 11:00',
    rewardCreditsEarned: 360,
    timeline: [
      { label: 'Stay Completed', time: '2024-09-07 10:00', done: true },
      { label: 'Points Credited', time: '2024-09-07 11:00', done: true },
    ],
  },
]

const NAING_LIN_TRANSACTIONS: Transaction[] = [
  {
    id: 'TXN-CC-20241120-8650', bookingId: 'BKG-8650', type: 'Booking Payment',
    description: 'Aureum Palace Bagan — Superior Room, Nov 22–23', amount: 215000, unit: 'MMK',
    paymentMethod: 'Credit/Debit Card', status: 'Completed', timestamp: '2024-11-20 16:10',
    paymentReference: 'CC-REF-20241120-001', hotelName: 'Aureum Palace Bagan',
    roomType: 'Superior Room', guestName: 'Naing Lin Aung', processingTime: '1.3s', rewardCreditsEarned: 215,
    timeline: [
      { label: 'Payment Initiated', time: '2024-11-20 16:09', done: true },
      { label: 'Payment Completed', time: '2024-11-20 16:10', done: true },
      { label: 'Booking Confirmed', time: '2024-11-20 16:11', done: true },
    ],
  },
  {
    id: 'RWD-20241123-8650', type: 'Reward Credit',
    description: '215 pts earned — Bagan stay completed', amount: 215, unit: 'pts',
    paymentMethod: 'Reward Wallet', status: 'Completed', timestamp: '2024-11-23 10:00',
    rewardCreditsEarned: 215,
    timeline: [
      { label: 'Stay Completed', time: '2024-11-23 09:00', done: true },
      { label: 'Points Credited', time: '2024-11-23 10:00', done: true },
    ],
  },
  {
    id: 'TXN-WP-20241210-9800', bookingId: 'BKG-9800', type: 'Booking Payment',
    description: 'Sedona Hotel Yangon — Deluxe Room, Dec 14–15', amount: 195000, unit: 'MMK',
    paymentMethod: 'Wave Pay', status: 'Pending', timestamp: '2024-12-10 20:00',
    paymentReference: 'WP-REF-20241210-002', hotelName: 'Sedona Hotel Yangon',
    roomType: 'Deluxe Room', guestName: 'Naing Lin Aung', processingTime: '—',
    timeline: [
      { label: 'Payment Initiated', time: '2024-12-10 20:00', done: true },
      { label: 'Payment Completed', time: '—', done: false },
      { label: 'Booking Confirmed', time: '—', done: false },
    ],
  },
]

const USER_TRANSACTIONS: Record<string, Transaction[]> = {
  'USR-042': ZAR_NI_TRANSACTIONS,
  'USR-001': WEI_LIN_TRANSACTIONS,
  'USR-015': AYE_MYAT_TRANSACTIONS,
  'USR-078': KYAW_ZIN_TRANSACTIONS,
  'USR-033': SU_SU_TRANSACTIONS,
  'USR-091': NAING_LIN_TRANSACTIONS,
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEBIT_TYPES: TransactionType[] = [
  'Booking Payment', 'Reward Redemption', 'Coupon Redemption', 'Voucher Redemption', 'Wallet Debit',
]

const AVATAR_COLORS = ['#1664FF', '#7C3AED', '#059669', '#D97706', '#DC2626', '#0D9488', '#6366F1', '#EC4899']

const ALL_TYPES: TransactionType[] = [
  'Booking Payment', 'Refund', 'Reward Credit', 'Reward Redemption',
  'Coupon Redemption', 'Voucher Redemption', 'Wallet Credit', 'Wallet Debit',
]

const ALL_METHODS: PaymentMethod[] = [
  'Credit/Debit Card', 'KBZPay', 'Wave Pay', 'Bank Transfer', 'Reward Wallet', 'Other',
]

const ALL_STATUSES: TransactionStatus[] = ['Pending', 'Completed', 'Failed', 'Refunded', 'Cancelled']

const PAGE_SIZE = 10

// ─── Helper Functions ─────────────────────────────────────────────────────────

function getAvatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function formatMMK(amount: number): string { return amount.toLocaleString() }

function formatSpending(amount: number): string {
  if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M MMK`
  if (amount >= 1000) return `${(amount / 1000).toFixed(0)}K MMK`
  return `${amount.toLocaleString()} MMK`
}

function formatMonthYear(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

function getTierColor(tier: MemberTier): string {
  return { Bronze: '#92400E', Silver: '#475569', Gold: '#D97706', Platinum: '#7C3AED' }[tier]
}

function getTierBg(tier: MemberTier): string {
  return { Bronze: '#FEF3C7', Silver: '#F1F5F9', Gold: '#FFFBEB', Platinum: '#EDE9FE' }[tier]
}

function getStatusColor(status: UserStatus): string {
  return { active: '#059669', suspended: '#D97706', blacklisted: '#DC2626', inactive: '#94A3B8' }[status]
}

// ─── Helper Components ────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase',
      letterSpacing: '0.05em', paddingBottom: 8, borderBottom: '1px solid #F1F5F9', marginBottom: 12,
    }}>
      {children}
    </div>
  )
}

function DetailKV({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 500, color: '#1A2332', fontFamily: mono ? 'monospace' : 'inherit' }}>{value}</div>
    </div>
  )
}

function TransactionTypeBadge({ type }: { type: TransactionType }) {
  const configs: Record<TransactionType, { icon: React.ReactNode; color: string; bg: string }> = {
    'Booking Payment':   { icon: <CreditCard size={11} />,     color: '#1664FF', bg: '#EEF4FF' },
    'Refund':            { icon: <RotateCcw size={11} />,       color: '#059669', bg: '#ECFDF3' },
    'Reward Credit':     { icon: <Gift size={11} />,            color: '#F59E0B', bg: '#FFFBEB' },
    'Reward Redemption': { icon: <Ticket size={11} />,          color: '#7C3AED', bg: '#EDE9FE' },
    'Coupon Redemption': { icon: <Tag size={11} />,             color: '#EC4899', bg: '#FDF2F8' },
    'Voucher Redemption':{ icon: <Bookmark size={11} />,        color: '#6366F1', bg: '#EEF2FF' },
    'Wallet Credit':     { icon: <ArrowDownCircle size={11} />, color: '#0D9488', bg: '#F0FDFA' },
    'Wallet Debit':      { icon: <ArrowUpCircle size={11} />,   color: '#EA580C', bg: '#FFF7ED' },
  }
  const cfg = configs[type]
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 20, backgroundColor: cfg.bg, color: cfg.color, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
      {cfg.icon}{type}
    </span>
  )
}

function TransactionStatusBadge({ status }: { status: TransactionStatus }) {
  const dot: Record<TransactionStatus, string> = { Pending: '#D97706', Completed: '#059669', Failed: '#DC2626', Refunded: '#1664FF', Cancelled: '#94A3B8' }
  const c = dot[status]
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: c, fontWeight: 500 }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: c, flexShrink: 0 }} />
      {status}
    </span>
  )
}

function AmountDisplay({ amount, unit, type }: { amount: number; unit: 'MMK' | 'pts'; type: TransactionType }) {
  const isDebit = DEBIT_TYPES.includes(type)
  const color = isDebit ? '#DC2626' : '#059669'
  const sign = isDebit ? '–' : '+'
  const formatted = unit === 'MMK' ? `${sign} MMK ${formatMMK(amount)}` : `${sign} ${amount.toLocaleString()} pts`
  return <span style={{ color, fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap' }}>{formatted}</span>
}

function KpiCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div style={{ backgroundColor: '#fff', borderRadius: 12, border: '1px solid #E3E8F0', padding: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#94A3B8' }}>{sub}</div>}
    </div>
  )
}

function ActionBtn({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button onClick={onClick} title={title}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 6, border: '1px solid #E3E8F0', backgroundColor: hovered ? '#F8FAFC' : '#fff', cursor: 'pointer', color: '#64748B', transition: 'all 0.15s' }}>
      {children}
    </button>
  )
}

function TxTimelineView({ timeline }: { timeline: TxTimeline[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {timeline.map((step, idx) => (
        <div key={idx} style={{ display: 'flex', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0, backgroundColor: step.done ? '#1664FF' : '#E3E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {step.done ? <CheckCircle size={12} color="#fff" /> : <Clock size={12} color="#94A3B8" />}
            </div>
            {idx < timeline.length - 1 && <div style={{ width: 2, flex: 1, minHeight: 16, backgroundColor: step.done ? '#1664FF' : '#E3E8F0', margin: '2px 0' }} />}
          </div>
          <div style={{ paddingBottom: idx < timeline.length - 1 ? 12 : 0 }}>
            <div style={{ fontSize: 13, fontWeight: step.done ? 600 : 400, color: step.done ? '#1A2332' : '#94A3B8' }}>{step.label}</div>
            <div style={{ fontSize: 11, color: '#94A3B8', fontFamily: 'monospace' }}>{step.time}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

function PaymentMethodDot({ method }: { method: PaymentMethod }) {
  const colors: Record<PaymentMethod, string> = { 'Credit/Debit Card': '#1664FF', 'KBZPay': '#DC2626', 'Wave Pay': '#D97706', 'Bank Transfer': '#059669', 'Reward Wallet': '#7C3AED', 'Other': '#94A3B8' }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#1A2332' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: colors[method], flexShrink: 0 }} />
      {method}
    </span>
  )
}

// ─── Drawer Content ───────────────────────────────────────────────────────────

function DrawerContent({ tx, activeUser }: { tx: Transaction; activeUser: EndUser }) {
  const hasReward = tx.rewardCreditsEarned || tx.rewardCreditsRedeemed || tx.couponApplied || tx.voucherUsed
  const avatarColor = getAvatarColor(activeUser.name)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* User info strip */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 10, background: '#F8FAFC', border: '1px solid #E3E8F0' }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
          {activeUser.avatar}
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1A2332' }}>{activeUser.name}</div>
          <div style={{ fontSize: 11, color: '#94A3B8', fontFamily: 'monospace' }}>{activeUser.id}</div>
        </div>
        <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4, backgroundColor: getTierBg(activeUser.tier), color: getTierColor(activeUser.tier), padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
          <Star size={9} />{activeUser.tier}
        </span>
      </div>

      {/* Transaction Information */}
      <div>
        <SectionLabel>Transaction Information</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <DetailKV label="Transaction ID" value={tx.id} mono />
          <DetailKV label="Payment Reference" value={tx.paymentReference ?? '—'} mono />
          <DetailKV label="Booking ID" value={tx.bookingId
            ? <span style={{ backgroundColor: '#EEF4FF', color: '#1664FF', padding: '2px 8px', borderRadius: 6, fontFamily: 'monospace', fontSize: 12 }}>{tx.bookingId}</span>
            : '—'} />
          <DetailKV label="Transaction Type" value={<TransactionTypeBadge type={tx.type} />} />
          <DetailKV label="Hotel Name" value={tx.hotelName ?? '—'} />
          <DetailKV label="Room Type" value={tx.roomType ?? '—'} />
        </div>
      </div>

      {/* Payment Information */}
      <div>
        <SectionLabel>Payment Information</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <DetailKV label="Payment Method" value={<PaymentMethodDot method={tx.paymentMethod} />} />
          <DetailKV label="Amount" value={<AmountDisplay amount={tx.amount} unit={tx.unit} type={tx.type} />} />
          <DetailKV label="Currency" value={tx.unit === 'MMK' ? 'Myanmar Kyat (MMK)' : 'Reward Points (pts)'} />
          <DetailKV label="Processing Time" value={tx.processingTime ?? '—'} />
          <DetailKV label="Status" value={<TransactionStatusBadge status={tx.status} />} />
          <DetailKV label="Date & Time" value={tx.timestamp} mono />
        </div>
      </div>

      {/* Reward Information */}
      {hasReward && (
        <div>
          <SectionLabel>Reward Information</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <DetailKV label="Credits Earned" value={tx.rewardCreditsEarned ? <span style={{ color: '#059669', fontWeight: 600 }}>+{tx.rewardCreditsEarned} pts</span> : '—'} />
            <DetailKV label="Credits Redeemed" value={tx.rewardCreditsRedeemed ? <span style={{ color: '#DC2626', fontWeight: 600 }}>–{tx.rewardCreditsRedeemed} pts</span> : '—'} />
            <DetailKV label="Coupon Applied" value={tx.couponApplied ?? '—'} />
            <DetailKV label="Voucher Used" value={tx.voucherUsed ?? '—'} />
          </div>
        </div>
      )}

      {/* Refund Information */}
      {tx.refundAmount != null && (
        <div>
          <SectionLabel>Refund Information</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <DetailKV label="Refund Amount" value={`MMK ${formatMMK(tx.refundAmount)}`} />
            <DetailKV label="Refund Status" value={tx.refundStatus ?? '—'} />
            <DetailKV label="Refund Date" value={tx.refundDate ?? '—'} />
            <DetailKV label="Reason" value={tx.refundReason ?? '—'} />
          </div>
        </div>
      )}

      {/* Timeline */}
      <div>
        <SectionLabel>Transaction Timeline</SectionLabel>
        <TxTimelineView timeline={tx.timeline} />
      </div>
    </div>
  )
}

function DrawerFooter({ tx, showToast }: { tx: Transaction; showToast: Props['showToast'] }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {tx.bookingId && (
        <button onClick={() => showToast('info', 'View Booking', `Opening booking ${tx.bookingId}`)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, border: '1px solid #E3E8F0', backgroundColor: '#fff', fontSize: 12, fontWeight: 500, color: '#1A2332', cursor: 'pointer' }}>
          <Calendar size={13} />View Booking
        </button>
      )}
      <button onClick={() => { navigator.clipboard.writeText(tx.id).catch(() => {}); showToast('success', 'Copied!', `Transaction ID ${tx.id} copied`) }}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, border: '1px solid #E3E8F0', backgroundColor: '#fff', fontSize: 12, fontWeight: 500, color: '#1A2332', cursor: 'pointer' }}>
        <Copy size={13} />Copy ID
      </button>
      <button onClick={() => showToast('success', 'Export', 'Transaction exported')}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, border: '1px solid #1664FF', backgroundColor: '#1664FF', fontSize: 12, fontWeight: 500, color: '#fff', cursor: 'pointer' }}>
        <Download size={13} />Export
      </button>
    </div>
  )
}

// ─── User Search Panel ────────────────────────────────────────────────────────
// ─── Empty State ──────────────────────────────────────────────────────────────

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function UserTransactionsPage({ showToast, user: userProp }: Props) {
  const [selectedUser, setSelectedUser] = useState<EndUser | null>(userProp ?? null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<TransactionType | ''>('')
  const [methodFilter, setMethodFilter] = useState<PaymentMethod | ''>('')
  const [statusFilter, setStatusFilter] = useState<TransactionStatus | ''>('')
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('all')
  const [page, setPage] = useState(1)
  const [drawerTx, setDrawerTx] = useState<Transaction | null>(null)

  useEffect(() => { setSelectedUser(userProp ?? null); setSearch(''); setTypeFilter(''); setMethodFilter(''); setStatusFilter(''); setDateRange('all'); setPage(1) }, [userProp])



  const transactions = selectedUser ? (USER_TRANSACTIONS[selectedUser.id] ?? []) : []

  const totalTransactions = transactions.length
  const totalSpending = transactions.filter(t => t.type === 'Booking Payment' && t.status === 'Completed').reduce((s, t) => s + t.amount, 0)
  const totalRefunds = transactions.filter(t => t.type === 'Refund').reduce((s, t) => s + t.amount, 0)
  const rewardEarned = transactions.filter(t => t.type === 'Reward Credit').reduce((s, t) => s + t.amount, 0)
  const rewardRedeemed = transactions.filter(t => t.type === 'Reward Redemption').reduce((s, t) => s + t.amount, 0)

  const now = new Date()
  const filtered = transactions.filter(tx => {
    if (search) {
      const q = search.toLowerCase()
      if (!tx.id.toLowerCase().includes(q) && !(tx.bookingId?.toLowerCase().includes(q)) && !(tx.paymentReference?.toLowerCase().includes(q))) return false
    }
    if (typeFilter && tx.type !== typeFilter) return false
    if (methodFilter && tx.paymentMethod !== methodFilter) return false
    if (statusFilter && tx.status !== statusFilter) return false
    if (dateRange !== 'all') {
      const txDate = new Date(tx.timestamp)
      const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90
      if (txDate < new Date(now.getTime() - days * 86400000)) return false
    }
    return true
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageStart = (safePage - 1) * PAGE_SIZE
  const paginated = filtered.slice(pageStart, Math.min(pageStart + PAGE_SIZE, filtered.length))

  const selectStyle: React.CSSProperties = { border: '1px solid #E3E8F0', borderRadius: 8, padding: '6px 10px', fontSize: 12, color: '#1A2332', backgroundColor: '#fff', cursor: 'pointer', outline: 'none' }

  return (
    <div style={{ backgroundColor: '#F8FAFC', minHeight: '100vh', padding: '24px 28px' }}>
      {/* Page header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>End User Management · User Transactions</div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#1A2332', margin: 0, marginBottom: 4 }}>Transaction History</h1>
          <div style={{ fontSize: 13, color: '#94A3B8' }}>
            {selectedUser ? `Financial transactions for ${selectedUser.name} — ${selectedUser.id}` : 'Select a user to view their financial transaction history'}
          </div>
        </div>
        {selectedUser && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => showToast('success', 'Export', `Transaction history for ${selectedUser.name} exported`)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1px solid #E3E8F0', backgroundColor: '#fff', fontSize: 13, fontWeight: 500, color: '#1A2332', cursor: 'pointer' }}>
              <Download size={14} />Export History
            </button>
            <button onClick={() => showToast('info', 'Print', 'Preparing receipt')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1px solid #E3E8F0', backgroundColor: '#fff', fontSize: 13, fontWeight: 500, color: '#1A2332', cursor: 'pointer' }}>
              <Printer size={14} />Print
            </button>

          </div>
        )}
      </div>

      {selectedUser && (() => {
        const avatarColor = getAvatarColor(selectedUser.name)
        const tierColor = getTierColor(selectedUser.tier)
        const tierBg = getTierBg(selectedUser.tier)
        const statusColor = getStatusColor(selectedUser.status)

        return (
          <>
            {/* User summary card */}
            <div style={{ backgroundColor: '#fff', borderRadius: 12, border: '1px solid #E3E8F0', padding: 20, display: 'flex', gap: 20, alignItems: 'flex-start', marginBottom: 20 }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', backgroundColor: avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 18, flexShrink: 0 }}>
                {selectedUser.avatar}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: '#1A2332' }}>{selectedUser.name}</span>
                  <span style={{ fontSize: 12, color: '#94A3B8', backgroundColor: '#F8FAFC', padding: '1px 8px', borderRadius: 6, fontFamily: 'monospace', border: '1px solid #E3E8F0' }}>{selectedUser.id}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, backgroundColor: tierBg, color: tierColor, padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
                    <Star size={10} />{selectedUser.tier}
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: statusColor }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: statusColor }} />
                    {selectedUser.status.charAt(0).toUpperCase() + selectedUser.status.slice(1)}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: '#64748B' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Mail size={11} />{selectedUser.email}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Phone size={11} />{selectedUser.phone}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Globe size={11} />{selectedUser.country}</span>
                  <span style={{ color: '#94A3B8' }}>Last login: {selectedUser.lastLogin}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 0, borderLeft: '1px solid #E3E8F0', paddingLeft: 20, flexShrink: 0 }}>
                {[
                  { label: 'Total Bookings', value: selectedUser.totalBookings.toString(), color: '#1664FF' },
                  { label: 'Total Spending', value: formatSpending(selectedUser.totalSpending), color: '#7C3AED' },
                  { label: 'Reward Balance', value: selectedUser.points.toLocaleString() + ' pts', color: '#D97706' },
                  { label: 'Member Since', value: formatMonthYear(selectedUser.registeredAt), color: '#64748B' },
                ].map((stat, idx) => (
                  <div key={idx} style={{ padding: '0 16px', borderRight: idx < 3 ? '1px solid #E3E8F0' : 'none', textAlign: 'center', minWidth: 90 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: stat.color }}>{stat.value}</div>
                    <div style={{ fontSize: 11, color: '#94A3B8', whiteSpace: 'nowrap' }}>{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* KPI cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 20 }}>
              <KpiCard label="Total Transactions" value={totalTransactions.toString()} color="#1664FF" />
              <KpiCard label="Total Spending" value={`MMK ${formatMMK(totalSpending)}`} color="#7C3AED" />
              <KpiCard label="Total Refunds" value={`MMK ${formatMMK(totalRefunds)}`} color="#059669" />
              <KpiCard label="Credits Earned" value={`${rewardEarned.toLocaleString()} pts`} color="#F59E0B" />
              <KpiCard label="Credits Redeemed" value={`${rewardRedeemed.toLocaleString()} pts`} color="#6366F1" />
            </div>

            {/* Filter bar */}
            <div style={{ backgroundColor: '#fff', border: '1px solid #E3E8F0', borderRadius: 8, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 240 }}>
                <Search size={14} color="#94A3B8" />
                <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
                  placeholder="Transaction ID, Booking ID, Payment Reference…"
                  style={{ flex: 1, border: 'none', outline: 'none', fontSize: 13, color: '#1A2332', backgroundColor: 'transparent', minWidth: 0 }} />
              </div>
              <div style={{ width: 1, height: 24, backgroundColor: '#E3E8F0', flexShrink: 0 }} />
              <Filter size={13} color="#94A3B8" />
              <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value as TransactionType | ''); setPage(1) }} style={selectStyle}>
                <option value="">All Types</option>
                {ALL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <select value={methodFilter} onChange={e => { setMethodFilter(e.target.value as PaymentMethod | ''); setPage(1) }} style={selectStyle}>
                <option value="">All Methods</option>
                {ALL_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value as TransactionStatus | ''); setPage(1) }} style={selectStyle}>
                <option value="">All Statuses</option>
                {ALL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={dateRange} onChange={e => { setDateRange(e.target.value as typeof dateRange); setPage(1) }} style={selectStyle}>
                <option value="all">All Time</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="90d">Last 90 Days</option>
              </select>
              <span style={{ fontSize: 12, color: '#94A3B8', whiteSpace: 'nowrap' }}>{filtered.length} results</span>
            </div>

            {/* Transaction table */}
            <div style={{ backgroundColor: '#fff', borderRadius: 12, border: '1px solid #E3E8F0', overflow: 'hidden', marginBottom: 16 }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E3E8F0' }}>
                      {['Transaction ID', 'Booking ID', 'Type', 'Description', 'Amount', 'Payment Method', 'Status', 'Date & Time', 'Actions'].map(col => (
                        <th key={col} style={{ padding: '10px 14px', textAlign: col === 'Amount' ? 'right' : 'left', fontSize: 11, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((tx, idx) => (
                      <tr key={tx.id} style={{ borderBottom: idx < paginated.length - 1 ? '1px solid #F8FAFC' : 'none', transition: 'background 0.1s' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.backgroundColor = '#FAFBFC' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.backgroundColor = '' }}>
                        <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 11, color: '#94A3B8', whiteSpace: 'nowrap' }}>{tx.id}</td>
                        <td style={{ padding: '10px 14px' }}>
                          {tx.bookingId
                            ? <span style={{ backgroundColor: '#EEF4FF', color: '#1664FF', padding: '2px 7px', borderRadius: 6, fontFamily: 'monospace', fontSize: 11, fontWeight: 500 }}>{tx.bookingId}</span>
                            : <span style={{ color: '#CBD5E1', fontSize: 12 }}>—</span>}
                        </td>
                        <td style={{ padding: '10px 14px' }}><TransactionTypeBadge type={tx.type} /></td>
                        <td style={{ padding: '10px 14px', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13, color: '#1A2332' }} title={tx.description}>{tx.description}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right' }}><AmountDisplay amount={tx.amount} unit={tx.unit} type={tx.type} /></td>
                        <td style={{ padding: '10px 14px' }}><PaymentMethodDot method={tx.paymentMethod} /></td>
                        <td style={{ padding: '10px 14px' }}><TransactionStatusBadge status={tx.status} /></td>
                        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                          <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#1A2332' }}>{tx.timestamp.split(' ')[0]}</div>
                          <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#94A3B8' }}>{tx.timestamp.split(' ')[1]}</div>
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <ActionBtn onClick={() => setDrawerTx(tx)} title="View Details"><Eye size={13} /></ActionBtn>
                            {tx.bookingId && <ActionBtn onClick={() => showToast('info', 'View Booking', `Opening ${tx.bookingId}`)} title="View Booking"><Calendar size={13} /></ActionBtn>}
                            {(tx.status === 'Completed' || tx.status === 'Refunded') && <ActionBtn onClick={() => showToast('success', 'View Receipt', `Opening receipt for ${tx.id}`)} title="View Receipt"><Receipt size={13} /></ActionBtn>}
                            {tx.type === 'Refund' && <ActionBtn onClick={() => showToast('info', 'Refund Details', `Opening refund details for ${tx.id}`)} title="View Refund Details"><RotateCcw size={13} /></ActionBtn>}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {paginated.length === 0 && (
                      <tr>
                        <td colSpan={9} style={{ padding: '40px 14px', textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
                          <XCircle size={24} color="#CBD5E1" style={{ display: 'block', margin: '0 auto 8px' }} />
                          No transactions match your current filters
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderTop: '1px solid #F1F5F9' }}>
                <span style={{ fontSize: 12, color: '#94A3B8' }}>
                  {filtered.length === 0 ? 'No transactions' : `Showing ${pageStart + 1}–${Math.min(pageStart + PAGE_SIZE, filtered.length)} of ${filtered.length}`}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 6, border: '1px solid #E3E8F0', backgroundColor: safePage === 1 ? '#F8FAFC' : '#fff', cursor: safePage === 1 ? 'not-allowed' : 'pointer', fontSize: 12, color: safePage === 1 ? '#CBD5E1' : '#1A2332' }}>
                    <ChevronLeft size={13} />Prev
                  </button>
                  <span style={{ fontSize: 12, color: '#1A2332', fontWeight: 500 }}>Page {safePage} of {totalPages}</span>
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 6, border: '1px solid #E3E8F0', backgroundColor: safePage === totalPages ? '#F8FAFC' : '#fff', cursor: safePage === totalPages ? 'not-allowed' : 'pointer', fontSize: 12, color: safePage === totalPages ? '#CBD5E1' : '#1A2332' }}>
                    Next<ChevronRight size={13} />
                  </button>
                </div>
              </div>
            </div>
          </>
        )
      })()}

      {/* Detail Drawer */}
      <Drawer
        open={!!drawerTx}
        onClose={() => setDrawerTx(null)}
        title={drawerTx?.id ?? ''}
        subtitle={drawerTx ? `${drawerTx.type} · ${drawerTx.timestamp}` : ''}
        width={520}
        footer={drawerTx && selectedUser ? <DrawerFooter tx={drawerTx} showToast={showToast} /> : undefined}>
        {drawerTx && selectedUser && <DrawerContent tx={drawerTx} activeUser={selectedUser} />}
      </Drawer>
    </div>
  )
}
