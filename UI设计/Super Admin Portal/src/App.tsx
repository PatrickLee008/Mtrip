import { useState } from 'react'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import ImpersonationBanner from './components/ImpersonationBanner'
import ToastContainer from './components/ToastContainer'
import { useToast } from './hooks/useToast'

import DashboardPage from './pages/DashboardPage'
import VerificationPage from './pages/VerificationPage'
import MerchantPage from './pages/MerchantPage'
import BookingAdminPage from './pages/BookingAdminPage'
import CampaignPage from './pages/CampaignPage'
import AffiliatePage from './pages/AffiliatePage'
import UserRolePage from './pages/UserRolePage'
import ReportsPage from './pages/ReportsPage'
import PlatformConfigPage from './pages/PlatformConfigPage'
import PlatformRulesPage from './pages/PlatformRulesPage'
import InventoryPage from './pages/InventoryPage'
import HelpCenterPage from './pages/HelpCenterPage'
import ContentManagementPage from './pages/ContentManagementPage'
import ReferralCampaignsPage from './pages/ReferralCampaignsPage'
import EndUserPage from './pages/EndUserPage'

export type PageId =
  | 'dashboard'
  // Merchant Verification
  | 'verification'
  | 'verification-under-review'
  | 'verification-approved'
  | 'verification-rejected'
  | 'verification-resubmission'
  // Merchant Management
  | 'merchants'
  | 'merchants-documents'
  | 'merchants-suspended'
  | 'merchants-blacklisted'
  | 'merchants-activities'
  // Platform Rules & Compliance
  | 'platform-rules'
  | 'merchant-violations'
  | 'warning-history'
  | 'compliance-history'
  // Booking Administration
  | 'bookings-admin'
  | 'bookings-refunds'
  | 'bookings-settlements'
  | 'bookings-history'
  // Campaign & Promotion
  | 'campaigns'
  | 'campaigns-promotions'
  | 'campaigns-vouchers'
  | 'campaigns-codes'
  | 'campaigns-welcome'
  | 'campaigns-analytics'
  // Affiliate & Influencer
  | 'affiliates'
  | 'affiliates-partner'
  | 'affiliates-program'
  | 'affiliates-withdrawals'
  | 'affiliates-fraud'
  | 'affiliates-referral'
  | 'affiliates-codes'
  // User & Role Management
  | 'users-roles'
  | 'users-roles-list'
  | 'users-roles-permissions'
  | 'users-sessions'
  // Reports & Analytics
  | 'reports'
  | 'reports-transactions'
  | 'reports-business'
  | 'reports-custom'
  // Platform Config
  | 'platform-config'
  // Help Center Management
  | 'helpcenter'
  | 'helpcenter-categories'
  | 'helpcenter-announcements'
  | 'helpcenter-analytics'
  // End User Management
  | 'endusers'
  | 'endusers-profile'
  | 'endusers-bookings'
  | 'endusers-activities'
  | 'endusers-transactions'
  | 'endusers-rewards'
  | 'endusers-support'
  | 'endusers-notifications'
  | 'endusers-suspended'
  | 'endusers-blacklist'
  // Inventory & Availability
  | 'inventory'
  | 'inventory-availability'
  | 'inventory-detail'
  | 'inventory-timeline'
  | 'inventory-calendar'
  | 'inventory-alerts'
  | 'inventory-reports'
  // Content Management
  | 'contentmgmt'
  | 'contentmgmt-banners'
  | 'contentmgmt-themes'

export interface Impersonation {
  merchantName: string
  merchantId: string
  reason: string
}

export default function App() {
  const [activePage, setActivePage] = useState<PageId>('dashboard')
  const [impersonation, setImpersonation] = useState<Impersonation | null>(null)
  const [endUserCtx, setEndUserCtx] = useState<{ name: string; avatar: string; tier: string } | null>(null)
  const { toasts, show: showToast, dismiss } = useToast()

  const verificationPages: PageId[] = [
    'verification', 'verification-under-review', 'verification-approved',
    'verification-rejected', 'verification-resubmission',
  ]
  const merchantPages: PageId[] = [
    'merchants', 'merchants-documents', 'merchants-suspended',
    'merchants-blacklisted', 'merchants-activities',
  ]
  const compliancePages: PageId[] = [
    'platform-rules', 'merchant-violations', 'warning-history', 'compliance-history',
  ]
  const bookingPages: PageId[] = [
    'bookings-admin', 'bookings-refunds', 'bookings-settlements', 'bookings-history',
  ]
  const campaignPages: PageId[] = [
    'campaigns', 'campaigns-promotions', 'campaigns-vouchers', 'campaigns-codes', 'campaigns-welcome', 'campaigns-analytics',
  ]
  const affiliatePages: PageId[] = [
    'affiliates', 'affiliates-partner', 'affiliates-program',
    'affiliates-withdrawals', 'affiliates-fraud', 'affiliates-codes',
  ]
  const endUserPages: PageId[] = [
    'endusers', 'endusers-profile', 'endusers-bookings', 'endusers-activities',
    'endusers-transactions', 'endusers-rewards', 'endusers-support', 'endusers-notifications',
    'endusers-suspended', 'endusers-blacklist',
  ]
  const inventoryPages: PageId[] = [
    'inventory', 'inventory-availability', 'inventory-detail', 'inventory-timeline',
    'inventory-calendar', 'inventory-alerts', 'inventory-reports',
  ]
  const userPages: PageId[] = [
    'users-roles', 'users-roles-list', 'users-roles-permissions', 'users-sessions',
  ]
  const contentMgmtPages: PageId[] = [
    'contentmgmt', 'contentmgmt-banners', 'contentmgmt-themes',
  ]

  return (
    <div className="flex flex-col h-full bg-surface overflow-hidden font-sans">
      {impersonation && (
        <ImpersonationBanner
          merchantName={impersonation.merchantName}
          merchantId={impersonation.merchantId}
          reason={impersonation.reason}
          onExit={() => {
            setImpersonation(null)
            showToast('info', 'Impersonation ended', `Exited session for ${impersonation.merchantName}`)
          }}
        />
      )}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          activePage={activePage}
          onNavigate={setActivePage}
          onLogout={() => showToast('info', 'Logged out', 'Your session has been terminated.')}
          endUserCtx={endUserCtx}
        />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Header activePage={activePage} impersonation={impersonation} />
          <main className="flex-1 overflow-auto">
            {activePage === 'dashboard' && (
              <DashboardPage showToast={showToast} onNavigate={setActivePage} />
            )}
            {verificationPages.includes(activePage) && (
              <VerificationPage tab={activePage} showToast={showToast} />
            )}
            {merchantPages.includes(activePage) && (
              <MerchantPage
                tab={activePage}
                showToast={showToast}
                onImpersonate={(imp) => {
                  setImpersonation(imp)
                  showToast('warning', 'Impersonation started', `Now acting as ${imp.merchantName}`)
                }}
              />
            )}
            {compliancePages.includes(activePage) && (
              <PlatformRulesPage tab={activePage} showToast={showToast} />
            )}
            {bookingPages.includes(activePage) && (
              <BookingAdminPage tab={activePage} showToast={showToast} />
            )}
            {campaignPages.includes(activePage) && (
              <CampaignPage tab={activePage} showToast={showToast} />
            )}
            {affiliatePages.includes(activePage) && (
              <AffiliatePage tab={activePage} showToast={showToast} />
            )}
            {activePage === 'affiliates-referral' && (
              <ReferralCampaignsPage tab={activePage} showToast={showToast} />
            )}
            {userPages.includes(activePage) && (
              <UserRolePage tab={activePage} showToast={showToast} />
            )}
            {endUserPages.includes(activePage) && (
              <EndUserPage tab={activePage} showToast={showToast} onEndUserChange={setEndUserCtx} onNavigate={setActivePage} />
            )}
            {inventoryPages.includes(activePage) && (
              <InventoryPage tab={activePage} showToast={showToast} />
            )}
            {(['reports', 'reports-transactions', 'reports-business', 'reports-custom'] as PageId[]).includes(activePage) && (
              <ReportsPage tab={activePage} showToast={showToast} />
            )}
            {activePage === 'platform-config' && (
              <PlatformConfigPage tab={activePage} showToast={showToast} />
            )}
            {contentMgmtPages.includes(activePage) && (
              <ContentManagementPage tab={activePage} showToast={showToast} />
            )}
            {(['helpcenter', 'helpcenter-categories', 'helpcenter-announcements', 'helpcenter-analytics'] as PageId[]).includes(activePage) && (
              <HelpCenterPage tab={activePage} showToast={showToast} />
            )}
          </main>
        </div>
      </div>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}
