import React, { createContext, useContext, useState, useEffect } from 'react';

export type Language = 'en' | 'si' | 'ta';

export interface LanguageOption {
  code: Language;
  name: string;
  nativeName: string;
  font: string;
  flag: string;
}

export const LANGUAGES: LanguageOption[] = [
  { code: 'en', name: 'English', nativeName: 'English', font: 'Plus Jakarta Sans', flag: '🇬🇧' },
  { code: 'si', name: 'Sinhala', nativeName: 'සිංහල', font: 'Noto Sans Sinhala', flag: '🇱🇰' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', font: 'Noto Sans Tamil', flag: '🇱🇰' },
];

export const translations: Record<Language, Record<string, string>> = {
  en: {
    system_name: 'Sara Ketha Harvest Hub',

    // Roles
    role_administrator: 'Administrator',
    role_manager: 'Manager',
    role_farmer: 'Farmer',
    role_collection_centre_officer: 'Collection Officer',
    role_quality_inspector: 'Quality Inspector',
    role_inventory_manager: 'Inventory Manager',
    role_buyer: 'Buyer',
    role_finance_officer: 'Finance Officer',
    role_transport_coordinator: 'Transport Coordinator',

    // Nav & System
    dashboard: 'Dashboard',
    users: 'User Management',
    crop_categories: 'Crop Categories',
    price_management: 'Price Management',
    collection_centres: 'Collection Centres',
    audit_logs: 'Audit Logs',
    reports: 'Reports',
    settings: 'Settings',
    notifications: 'Notifications',
    register_collection: 'Register Collection',
    collection_history: 'Collection History',
    marketplace: 'Marketplace',
    my_orders: 'My Orders',
    invoices: 'Invoices',
    buyer_invoices: 'Buyer Invoices',
    farmer_invoices: 'Farmer Invoices',
    approve_disburse_payments: 'Approve & Disburse Payments',
    payment_history: 'Payment History',
    active_deliveries: 'Active Shipments',
    fleet_vehicles: 'Fleet & Drivers',
    auctions: 'Auctions',
    auction_approval: 'Auction Approval',
    auction_monitoring: 'Auction Monitoring',
    auction_reports: 'Auction Reports',
    logout: 'Logout',
    quick_search: 'Quick search...',
    refresh: 'Refresh',
    add: 'Add',
    edit: 'Edit',
    delete: 'Delete',
    cancel: 'Cancel',
    save: 'Save',
    create: 'Create',
    update: 'Update',
    active: 'Active',
    inactive: 'Inactive',
    suspended: 'Suspended',
    pending: 'Pending',
    status: 'Status',
    actions: 'Actions',
    role: 'Role',
    registered: 'Registered',
    user: 'User',
    centre: 'Centre',
    name: 'Name',
    code: 'Code',
    address: 'Address',
    district: 'District',
    phone: 'Phone',
    email: 'Email',
    capacity: 'Capacity (kg)',
    grade: 'Grade',
    purchase_price: 'Purchase Price (LKR)',
    selling_price: 'Selling Price (LKR)',
    margin: 'Margin',
    effective_date: 'Effective Date',
    add_category: 'Add Category',
    add_price: 'Add Price',
    add_centre: 'Add Collection Centre',
    add_user: 'Add User Account',

    // Dashboard
    admin_dashboard_title: 'Administrator Dashboard',
    welcome_back: 'Welcome back',
    system_overview: 'System overview',
    registered_farmers: 'Registered Farmers',
    active_accounts: 'Active accounts',
    active_crops: 'Active Crops',
    todays_collections: "Today's Collections",
    available_stock: 'Available Stock (kg)',
    today_accepted: 'Today Accepted (kg)',
    today_rejected: 'Today Rejected (kg)',
    near_expiry: 'Near-Expiry Batches',
    pending_farmer_payments: 'Pending Farmer Payments',
    outstanding_invoices: 'Outstanding Invoices',
    active_orders: 'Active Orders',
    monthly_revenue: 'Monthly Revenue',
    monthly_payouts: 'Monthly Payouts',
    revenue_vs_payouts: 'Monthly Revenue vs. Farmer Payouts (LKR)',
    quick_actions: 'Quick Actions',
    manage_users: 'Manage Users',
    view_audit_logs: 'View Audit Logs',
    system_settings: 'System Settings',
    view_reports: 'View Reports',

    // Page Subtitles
    crop_categories_subtitle: 'Standardized crop classifications and varieties supported by Sara Ketha Harvest Hub',
    price_management_subtitle: 'Current market purchase and selling prices for all crop grades',
    collection_centres_subtitle: 'Agricultural collection centres and hub locations across Sri Lanka',
    user_management_subtitle: 'View, manage roles, and monitor user account statuses across Sara Ketha Harvest Hub',

    // Empty States
    no_categories_found: 'No crop categories found.',
    no_prices_found: 'No active crop prices found.',
    no_centres_found: 'No collection centres found.',
    no_users_found: 'No users found',

    // Farmer
    my_profile: 'My Profile',
    my_crops: 'My Crops',
    schedule_delivery: 'Schedule Delivery',
    appointments: 'Appointments',
    collections: 'Collections',
    payments: 'Payments',
    produce_auctions: 'Produce Auctions',
    complaints: 'Complaints',
    welcome: 'Welcome',
    farmer_dashboard_subtitle: 'Your farm management and AI crop recommendation dashboard',
    ask_sara_ketha_bot: 'Ask Sara Ketha Bot',
    sara_ketha_advisory_engine: 'Java ML / Weka Engine (Random Forest Classifier)',
    banner_ai_suggestions_title: 'Get AI-Powered Optimal Crop Cultivation Suggestions',
    banner_ai_suggestions_desc: 'Our AI model predicts the highest-yielding crop recommendations based on your district location, crop rotation history, and soil conditions in English, Sinhala & Tamil.',
    launch_sara_ketha_bot: 'Launch Sara Ketha Bot',
    total_collections: 'Total Collections',
    paid_amount: 'Paid Amount',
    pending_payment: 'Pending Payment',
    account_pending_verification: 'Account Pending Verification',
    account_pending_verification_desc: 'Your farmer account is under review. A collection centre officer will verify your details.',
    recent_collections: 'Recent Collections',
    view_all: 'View all',
    no_collections_yet: 'No collections yet',
    schedule_first_delivery: 'Schedule First Delivery',
    register_crop: 'Register Crop',
    view_prices: 'View Prices',
    submit_complaint: 'Submit Complaint',
    recent_payments: 'Recent Payments',
    no_payments_yet: 'No payments yet',
    payments_subtitle: 'Track your payment history and payout status',
    no_payments_desc: 'Your payments will appear here after your produce is collected, inspected, and calculated by the finance team.',
    ask_crop_ai_advisor: 'Ask Crop AI Advisor',
    predict_optimal_crops_desc: 'Predict optimal crops for your location in EN, SI, TA',
    not_weighed: 'Not weighed',
    my_crops_subtitle: 'Manage your registered crops and cultivation details',
    no_crops_registered: 'No Crops Registered',
    no_crops_desc: 'Start by registering your first crop to begin tracking your harvest.',
    register_first_crop: 'Register Your First Crop',
    area: 'Area',
    acres: 'acres',
    planted: 'Planted',
    harvest: 'Harvest',
    expected: 'Expected',
    farming_method: 'Farming Method',
    conventional: 'Conventional',
    organic: 'Organic',
    hydroponic: 'Hydroponic',
    mixed: 'Mixed',
    no_variety_specified: 'No variety specified',
    edit_crop: 'Edit Crop',
    update_crop: 'Update Crop',
    confirm_delete_crop: 'Are you sure you want to remove your crop record?',

    // Added: manager role, receipts, wastage, reporting
    auction_monitor: 'Live Auction Monitor',
    live_auctions: 'Live Auctions',
    management_reports: 'Management Reports',
    orders: 'Orders',
    quality_analytics: 'Quality Analytics',
    start_live_auction: 'Start Live Auction',
    wastage: 'Wastage Records',
    receipts: 'Receipts',
    outstanding_payments: 'Outstanding Payments',
    confirm_receipt: 'Confirm receipt',
    dispute_receipt: 'Dispute receipt',
    cancel_appointment: 'Cancel appointment',
    print: 'Print',
    export_csv: 'Export CSV',
  },

  si: {
    system_name: 'සාර කෙත Harvest Hub',

    // Roles
    role_administrator: 'පරිපාලක',
    role_farmer: 'ගොවියා',
    role_collection_centre_officer: 'එකතු කිරීමේ නිලධාරී',
    role_quality_inspector: 'තත්ත්ව පරීක්ෂක',
    role_inventory_manager: 'තොග කළමනාකරු',
    role_buyer: 'ගැනුම්කරු',
    role_finance_officer: 'මුදල් නිලධාරී',
    role_transport_coordinator: 'ප්‍රවාහන සම්බන්ධීකාරක',

    // Nav & System
    dashboard: 'පාලන පුවරුව',
    users: 'පරිශීලක කළමනාකරණය',
    crop_categories: 'බෝග වර්ගීකරණය',
    price_management: 'මිල ගණන් කළමනාකරණය',
    collection_centres: 'එකතු කිරීමේ මධ්‍යස්ථාන',
    audit_logs: 'ගණන් පරීක්ෂණ සටහන්',
    reports: 'වාර්තා',
    settings: 'සිටුවම්',
    notifications: 'දැනුම්දීම්',
    marketplace: 'වෙළඳපොළ',
    my_orders: 'මගේ ඇණවුම්',
    invoices: 'ඉන්වොයිසි',
    active_deliveries: 'ක්‍රියාකාරී ප්‍රවාහන',
    fleet_vehicles: 'වාහන සහ රියදුරන්',
    auctions: 'වෙන්දේසි',
    auction_approval: 'වෙන්දේසි අනුමැතිය',
    auction_monitoring: 'වෙන්දේසි නිරීක්ෂණය',
    auction_reports: 'වෙන්දේසි වාර්තා',
    logout: 'නික්මෙන්න',
    quick_search: 'ඉක්මන් සෙවීම...',
    refresh: 'යාවත්කාලීන කරන්න',
    add: 'එක් කරන්න',
    edit: 'සංස්කරණය',
    delete: 'ඉවත් කරන්න',
    cancel: 'අවලංගු කරන්න',
    save: 'සුරකින්න',
    create: 'නිර්මාණය කරන්න',
    update: 'යාවත්කාලීන කරන්න',
    active: 'ක්‍රියාකාරී',
    inactive: 'අක්‍රිය',
    suspended: 'අත්හිටුවන ලද',
    pending: 'පොරොත්තුවේ',
    status: 'තත්ත්වය',
    actions: 'ක්‍රියාමාර්ග',
    role: 'භූමිකාව',
    registered: 'ලියාපදිංචි දිනය',
    user: 'පරිශීලකයා',
    centre: 'මධ්‍යස්ථානය',
    name: 'නම',
    code: 'සංකේතය',
    address: 'ලිපිනය',
    district: 'දිස්ත්‍රික්කය',
    phone: 'දුරකථනය',
    email: 'විද්‍යුත් තැපෑල',
    capacity: 'ධාරිතාව (කිලෝග්‍රෑම්)',
    grade: 'තත්ත්ව ශ්‍රේණිය',
    purchase_price: 'ගැනුම් මිල (රු.)',
    selling_price: 'විකුණුම් මිල (රු.)',
    margin: 'ලාභ පරතරය',
    effective_date: 'බලපැවැත්වෙන දිනය',
    add_category: 'බෝග වර්ගයක් එක් කරන්න',
    add_price: 'මිල ගණන් එක් කරන්න',
    add_centre: 'මධ්‍යස්ථානයක් එක් කරන්න',
    add_user: 'පරිශීලකයෙකු එක් කරන්න',

    // Dashboard
    admin_dashboard_title: 'පරිපාලක පාලන පුවරුව',
    welcome_back: 'නැවත සාදරයෙන් පිළිගනිමු',
    system_overview: 'පද්ධති දළ විශ්ලේෂණය',
    registered_farmers: 'ලියාපදිංචි ගොවීන්',
    active_accounts: 'සක්‍රීය ගිණුම්',
    active_crops: 'සක්‍රීය බෝග',
    todays_collections: 'අද දින එකතු කිරීම්',
    available_stock: 'පවතින තොගය (කිලෝග්‍රෑම්)',
    today_accepted: 'අද බාරගත් ප්‍රමාණය (කිලෝග්‍රෑම්)',
    today_rejected: 'අද ප්‍රතික්ෂේපිත ප්‍රමාණය (කිලෝග්‍රෑම්)',
    near_expiry: 'කල්ඉකුත් වීමට ආසන්න තොග',
    pending_farmer_payments: 'පොරොත්තුවේ ඇති ගොවි ගෙවීම්',
    outstanding_invoices: 'ගෙවීමට ඇති ඉන්වොයිසි',
    active_orders: 'සක්‍රීය ඇණවුම්',
    monthly_revenue: 'මාසික ආදායම',
    monthly_payouts: 'මාසික ගෙවීම්',
    revenue_vs_payouts: 'මාසික ආදායම සහ ගොවි ගෙවීම් (රු.)',
    quick_actions: 'ඉක්මන් ක්‍රියාමාර්ග',
    manage_users: 'පරිශීලකයින් කළමනාකරණය',
    view_audit_logs: 'ගණන් පරීක්ෂණ සටහන් බලන්න',
    system_settings: 'පද්ධති සිටුවම්',
    view_reports: 'වාර්තා බලන්න',

    // Page Subtitles
    crop_categories_subtitle: 'සාර කෙත Harvest Hub මගින් සහාය දක්වන සම්මත බෝග වර්ගීකරණයන්',
    price_management_subtitle: 'සියලුම බෝග ශ්‍රේණි සඳහා වත්මන් වෙළඳපොළ ගැනුම් සහ විකුණුම් මිල ගණන්',
    collection_centres_subtitle: 'ශ්‍රී ලංකාව පුරා පිහිටි කෘෂිකාර්මික එකතු කිරීමේ මධ්‍යස්ථාන',
    user_management_subtitle: 'පරිශීලක භූමිකාවන් සහ ගිණුම් තත්ත්වයන් කළමනාකරණය කරන්න',

    // Empty States
    no_categories_found: 'බෝග වර්ගීකරණයන් හමු නොවීය.',
    no_prices_found: 'සක්‍රීය බෝග මිල ගණන් හමු නොවීය.',
    no_centres_found: 'එකතු කිරීමේ මධ්‍යස්ථාන හමු නොවීය.',
    no_users_found: 'පරිශීලකයින් හමු නොවීය',

    // Farmer
    my_profile: 'මගේ ගිණුම',
    my_crops: 'මගේ බෝග',
    schedule_delivery: 'භාරදීම සැලසුම් කරන්න',
    appointments: 'වෙන්කරවා ගැනීම්',
    collections: 'එකතු කිරීම්',
    payments: 'ගෙවීම්',
    produce_auctions: 'නිෂ්පාදන වෙන්දේසි',
    complaints: 'පැමිණිලි',
    welcome: 'සාදරයෙන් පිළිගනිමු',
    farmer_dashboard_subtitle: 'ඔබගේ ගොවිපල කළමනාකරණය සහ කෘතිම බුද්ධි බෝග උපදේශක පාලන පුවරුව',
    ask_sara_ketha_bot: 'සාර කෙත Bot ගෙන් අසන්න',
    sara_ketha_advisory_engine: 'Java ML / Weka එන්ජිම (Random Forest Classifier)',
    banner_ai_suggestions_title: 'AI මගින් පෝෂිත බෝග වගා උපදෙස් ලබා ගන්න',
    banner_ai_suggestions_desc: 'ඔබගේ දිස්ත්‍රික්කය, පූර්ව වගා ඉතිහාසය සහ පස් තත්ත්වය අනුව වැඩිම අස්වැන්නක් ලබා දෙන බෝග නිර්දේශ සිංහල, දෙමළ සහ ඉංග්‍රීසි භාෂාවලින් ලබා දෙයි.',
    launch_sara_ketha_bot: 'සාර කෙත Bot ආරම්භ කරන්න',
    total_collections: 'මුළු එකතු කිරීම්',
    paid_amount: 'ගෙවන ලද මුදල',
    pending_payment: 'ලැබීමට ඇති ගෙවීම්',
    account_pending_verification: 'ගිණුම පරීක්ෂාවට ලක්වෙමින් පවතී',
    account_pending_verification_desc: 'ඔබගේ ගොවි ගිණුම පරීක්ෂාවට ලක්වෙමින් පවතී. එකතු කිරීමේ නිලධාරියෙකු ඔබගේ තොරතුරු තහවුරු කරනු ඇත.',
    recent_collections: 'මෑත එකතු කිරීම්',
    view_all: 'සියල්ල බලන්න',
    no_collections_yet: 'තවම එකතු කිරීම් නොමැත',
    schedule_first_delivery: 'පළමු භාරදීම සැලසුම් කරන්න',
    register_crop: 'බෝග ලියාපදිංචිය',
    view_prices: 'මිල ගණන් බලන්න',
    submit_complaint: 'පැමිණිල්ලක් යොමු කරන්න',
    recent_payments: 'මෑත ගෙවීම්',
    no_payments_yet: 'තවම ගෙවීම් නොමැත',
    ask_crop_ai_advisor: 'බෝග AI උපදේශකගෙන් අසන්න',
    predict_optimal_crops_desc: 'ඔබගේ ප්‍රදේශයට සුදුසුම බෝග සිංහල, දෙමළ හා ඉංග්‍රීසි භාෂාවලින් සොයා ගන්න',
    not_weighed: 'කිරා නොමැත',
    my_crops_subtitle: 'ඔබගේ ලියාපදිංචි බෝග සහ වගා තොරතුරු කළමනාකරණය කරන්න',
    no_crops_registered: 'ලියාපදිංචි කළ බෝග නොමැත',
    no_crops_desc: 'අස්වැන්න නිරීක්ෂණය ආරම්භ කිරීමට ඔබගේ පළමු බෝගය ලියාපදිංචි කරන්න.',
    register_first_crop: 'ඔබගේ පළමු බෝගය ලියාපදිංචි කරන්න',
    area: 'ප්‍රමාණය',
    acres: 'අක්කර',
    planted: 'වගා කළ දිනය',
    harvest: 'අස්වනු දිනය',
    expected: 'අපේක්ෂිත ප්‍රමාණය',
    farming_method: 'වගා ක්‍රමය',
    conventional: 'සාම්ප්‍රදායික',
    organic: 'කාබනික',
    hydroponic: 'ජලරෝපිත (හයිඩ්‍රොපොනික්)',
    mixed: 'මිශ්‍ර',
    no_variety_specified: 'විශේෂ ප්‍රභේදයක් සඳහන් කර නොමැත',
    edit_crop: 'බෝග තොරතුරු සංස්කරණය',
    update_crop: 'බෝගය යාවත්කාලීන කරන්න',
    confirm_delete_crop: 'ඔබට මෙම බෝග සටහන ඉවත් කිරීමට අවශ්‍ය බව විශ්වාසද?',

    // Added: manager role, receipts, wastage, reporting
    role_manager: 'කළමනාකරු',
    register_collection: 'එකතුව ලියාපදිංචි කරන්න',
    collection_history: 'එකතු කිරීමේ ඉතිහාසය',
    buyer_invoices: 'ගැනුම්කරු ඉන්වොයිස්',
    farmer_invoices: 'ගොවි ඉන්වොයිස්',
    approve_disburse_payments: 'ගෙවීම් අනුමත කර නිකුත් කරන්න',
    payment_history: 'ගෙවීම් ඉතිහාසය',
    payments_subtitle: 'ඔබේ ගෙවීම් සහ රිසිට්පත් නිරීක්ෂණය කරන්න',
    no_payments_desc: 'ඔබේ නිෂ්පාදන පරීක්ෂා කර ගෙවීම ගණනය කළ පසු ගෙවීම් මෙහි දිස්වේ.',
    auction_monitor: 'සජීවී වෙන්දේසි නිරීක්ෂණය',
    live_auctions: 'සජීවී වෙන්දේසි',
    management_reports: 'කළමනාකරණ වාර්තා',
    orders: 'ඇණවුම්',
    quality_analytics: 'ගුණාත්මක විශ්ලේෂණ',
    start_live_auction: 'සජීවී වෙන්දේසියක් අරඹන්න',
    wastage: 'අපතේ යාමේ වාර්තා',
    receipts: 'රිසිට්පත්',
    outstanding_payments: 'ගෙවීමට ඇති ශේෂ',
    confirm_receipt: 'රිසිට්පත තහවුරු කරන්න',
    dispute_receipt: 'රිසිට්පතට විරුද්ධ වන්න',
    cancel_appointment: 'වේලාව අවලංගු කරන්න',
    print: 'මුද්\u200dරණය',
    export_csv: 'CSV අපනයනය',
  },

  ta: {
    system_name: 'சாரா கேதா Harvest Hub',

    // Roles
    role_administrator: 'நிர்வாகி',
    role_farmer: 'விவசாயி',
    role_collection_centre_officer: 'சேகரிப்பு அதிகாரி',
    role_quality_inspector: 'தர ஆய்வாளர்',
    role_inventory_manager: 'சரக்கு மேலாளர்',
    role_buyer: 'கொள்முதல் செய்பவர்',
    role_finance_officer: 'நிதி அதிகாரி',
    role_transport_coordinator: 'போக்குவரத்து ஒருங்கிணைப்பாளர்',

    // Nav & System
    dashboard: 'தகவல் பலகை',
    users: 'பயனாளர் மேலாண்மை',
    crop_categories: 'பயிர் வகைகள்',
    price_management: 'விலை மேலாண்மை',
    collection_centres: 'சேகரிப்பு மையங்கள்',
    audit_logs: 'தணிக்கை பதிவுகள்',
    reports: 'அறிக்கைகள்',
    settings: 'அமைப்புகள்',
    notifications: 'அறிவிப்புகள்',
    marketplace: 'சந்தை',
    my_orders: 'எனது ஆர்டர்கள்',
    invoices: 'விலைப்பட்டியல்கள்',
    active_deliveries: 'செயலில் உள்ள விநியோகங்கள்',
    fleet_vehicles: 'வாகனங்கள் & ஓட்டுநர்கள்',
    auctions: 'ஏலங்கள்',
    auction_approval: 'ஏல ஒப்புதல்',
    auction_monitoring: 'ஏல கண்காணிப்பு',
    auction_reports: 'ஏல அறிக்கைகள்',
    logout: 'வெளியேறு',
    quick_search: 'விரைவுத் தேடல்...',
    refresh: 'புதுப்பி',
    add: 'சேர்',
    edit: 'திருத்து',
    delete: 'நீக்கு',
    cancel: 'ரத்து செய்',
    save: 'சேமி',
    create: 'உருவாக்கு',
    update: 'இணைக்க',
    active: 'செயலில்',
    inactive: 'செயலற்றது',
    suspended: 'நிறுத்தி வைக்கப்பட்டது',
    pending: 'நிலுவையில்',
    status: 'நிலை',
    actions: 'செயல்கள்',
    role: 'பங்கு',
    registered: 'பதிவு செய்யப்பட்டது',
    user: 'பயனர்',
    centre: 'மையம்',
    name: 'பெயர்',
    code: 'குறியீடு',
    address: 'முகவரி',
    district: 'மாவட்டம்',
    phone: 'தொலைபேசி',
    email: 'மின்னஞ்சல்',
    capacity: 'கொள்திறன் (கிலோ)',
    grade: 'தரம்',
    purchase_price: 'கொள்முதல் விலை (ரூ.)',
    selling_price: 'விற்பனை விலை (ரூ.)',
    margin: 'இலாப வரம்பு',
    effective_date: 'அமுலுக்கு வரும் தேதி',
    add_category: 'பயிர் வகை சேர்',
    add_price: 'விலை சேர்',
    add_centre: 'சேகரிப்பு மையம் சேர்',
    add_user: 'பயனர் சேர்',

    // Dashboard
    admin_dashboard_title: 'நிர்வாகி தகவல் பலகை',
    welcome_back: 'மீண்டும் வருக',
    system_overview: 'கணினி கண்ணோட்டம்',
    registered_farmers: 'பதிவு செய்யப்பட்ட விவசாயிகள்',
    active_accounts: 'செயலில் உள்ள கணக்குகள்',
    active_crops: 'செயலில் உள்ள பயிர்கள்',
    todays_collections: 'இன்றைய சேகரிப்புகள்',
    available_stock: 'கிடைக்கும் பங்கு (கிலோ)',
    today_accepted: 'இன்று ஏற்றுக்கொள்ளப்பட்டது (கிலோ)',
    today_rejected: 'இன்று நிராகரிக்கப்பட்டது (கிலோ)',
    near_expiry: 'காலாவதியாகும் தொகுதிகள்',
    pending_farmer_payments: 'நிலுவையில் உள்ள விவசாயி செலுத்துதல்கள்',
    outstanding_invoices: 'நிலுவையில் உள்ள இன்வாய்ஸ்கள்',
    active_orders: 'செயலில் உள்ள ஆர்டர்கள்',
    monthly_revenue: 'மாதாந்திர வருவாய்',
    monthly_payouts: 'மாதாந்திர செலுத்துதல்கள்',
    revenue_vs_payouts: 'மாதாந்திர வருவாய் மற்றும் விவசாயி செலுத்துதல்கள் (ரூ.)',
    quick_actions: 'விரைவான செயல்கள்',
    manage_users: 'பயனர்களை நிர்வகித்தல்',
    view_audit_logs: 'தணிக்கை பதிவுகளைப் பார்க்கவும்',
    system_settings: 'பද්ධதி அமைப்புகள்',
    view_reports: 'அறிக்கைகளைப் பார்க்கவும்',

    // Page Subtitles
    crop_categories_subtitle: 'சாரா கேதா Harvest Hub ஆதரவளிக்கும் நிலையான பயிர் வகைப்பாடுகள்',
    price_management_subtitle: 'அனைத்து பயிர் தரங்களுக்குமான தற்போதைய சந்தை கொள்முதல் மற்றும் விற்பனை விலைகள்',
    collection_centres_subtitle: 'இலங்கை முழுவதும் உள்ள விவசாய சேகரிப்பு மையங்கள்',
    user_management_subtitle: 'பயனர் பாத்திரங்கள் மற்றும் கணக்கு நிலைகளை நிர்வகிக்கவும்',

    // Empty States
    no_categories_found: 'பயிர் வகைகள் எதுவும் காணப்படவில்லை.',
    no_prices_found: 'செயலில் உள்ள பயிர் விலைகள் எதுவும் காணப்படவில்லை.',
    no_centres_found: 'சேகரிப்பு மையங்கள் எதுவும் காணப்படவில்லை.',
    no_users_found: 'பயனர்கள் காணப்படவில்லை',

    // Farmer
    my_profile: 'எனது விபரம்',
    my_crops: 'எனது பயிர்கள்',
    schedule_delivery: 'விநியோக நேரம்',
    appointments: 'சந்திப்புகள்',
    collections: 'சேகரிப்புகள்',
    payments: 'செலுத்தல்கள்',
    produce_auctions: 'உற்பத்தி ஏலம்',
    complaints: 'புகார்கள்',
    welcome: 'வரவேற்கிறோம்',
    farmer_dashboard_subtitle: 'உங்கள் பண்ணை மேலாண்மை மற்றும் AI பயிர் ஆலோசனை தகவல் பலகை',
    ask_sara_ketha_bot: 'சாரா கேதா போட்டிடம் கேளுங்கள்',
    sara_ketha_advisory_engine: 'Java ML / Weka எஞ்சின் (Random Forest Classifier)',
    banner_ai_suggestions_title: 'AI பயிர் சாகுபடி ஆலோசனைகளைப் பெறுங்கள்',
    banner_ai_suggestions_desc: 'உங்கள் மாவட்டம், முந்தைய பயிர் சுழற்சி மற்றும் மண் நிலைகளின் அடிப்படையில் சிறந்த பயிர் பரிந்துரைகளைப் பெறுங்கள்.',
    launch_sara_ketha_bot: 'சாரா கேதா போட்டைத் தொடங்குங்கள்',
    total_collections: 'மொத்த சேகரிப்புகள்',
    paid_amount: 'செலுத்தப்பட்ட தொகை',
    pending_payment: 'நிலுவையில் உள்ள தொகை',
    account_pending_verification: 'கணக்கு சரிபார்ப்பில் உள்ளது',
    account_pending_verification_desc: 'உங்கள் விவசாயி கணக்கு பரிசீலனையில் உள்ளது. ஒரு அதிகாரி உங்கள் விவரங்களை சரிபார்ப்பார்.',
    recent_collections: 'சமீபத்திய சேகரிப்புகள்',
    view_all: 'அனைத்தையும் பார்',
    no_collections_yet: 'இன்னும் சேகரிப்புகள் இல்லை',
    schedule_first_delivery: 'முதல் விநியோகத்தை திட்டமிடுங்கள்',
    register_crop: 'பயிர் பதிவு',
    view_prices: 'விலைகளைப் பார்க்கவும்',
    submit_complaint: 'புகார் சமர்ப்பிக்கவும்',
    recent_payments: 'சமீபத்திய செலுத்துதல்கள்',
    no_payments_yet: 'இன்னும் செலுத்துதல்கள் இல்லை',
    ask_crop_ai_advisor: 'பயிர் AI ஆலோசகரிடம் கேளுங்கள்',
    predict_optimal_crops_desc: 'உங்கள் இருப்பிடத்திற்கு ஏற்ற சிறந்த பயிர்களைக் கண்டறியவும்',
    not_weighed: 'எடை போடப்படவில்லை',
    my_crops_subtitle: 'உங்கள் பதிவு செய்யப்பட்ட பயிர்கள் மற்றும் சாகுபடி விவரங்களை நிர்வகிக்கவும்',
    no_crops_registered: 'பதிவு செய்யப்பட்ட பயிர்கள் இல்லை',
    no_crops_desc: 'உங்கள் அறுவடையைக் கண்காணிக்க உங்கள் முதல் பயிரைப் பதிவு செய்யத் தொடங்குங்கள்.',
    register_first_crop: 'உங்கள் முதல் பயிரைப் பதிவு செய்யுங்கள்',
    area: 'பரப்பளவு',
    acres: 'ஏக்கர்',
    planted: 'நட்ட தேதி',
    harvest: 'அறுவடை தேதி',
    expected: 'எதிர்பார்க்கப்படும் அளவு',
    farming_method: 'சாகுபடி முறை',
    conventional: 'பாரம்பரிய முறை',
    organic: 'இயற்கை முறை',
    hydroponic: 'ஹைட்ரோபோனிக்',
    mixed: 'கலப்பு முறை',
    no_variety_specified: 'குறிப்பிட்ட வகை எதுவும் குறிப்பிடப்படவில்லை',
    edit_crop: 'பயிரைத் திருத்து',
    update_crop: 'பயிரைப் புதுப்பி',
    confirm_delete_crop: 'இந்த பயிர் பதிவை நீக்க நிச்சயமாக விரும்புகிறீர்களா?',

    // Added: manager role, receipts, wastage, reporting
    role_manager: 'மேலாளர்',
    register_collection: 'சேகரிப்பைப் பதிவு செய்',
    collection_history: 'சேகரிப்பு வரலாறு',
    buyer_invoices: 'வாங்குபவர் விலைப்பட்டியல்கள்',
    farmer_invoices: 'விவசாயி விலைப்பட்டியல்கள்',
    approve_disburse_payments: 'கொடுப்பனவுகளை அங்கீகரித்து வழங்கு',
    payment_history: 'கொடுப்பனவு வரலாறு',
    payments_subtitle: 'உங்கள் கொடுப்பனவுகளையும் ரசீதுகளையும் கண்காணிக்கவும்',
    no_payments_desc: 'உங்கள் விளைபொருள் ஆய்வு செய்யப்பட்டு கொடுப்பனவு கணக்கிடப்பட்டதும் இங்கே தோன்றும்.',
    auction_monitor: 'நேரடி ஏல கண்காணிப்பு',
    live_auctions: 'நேரடி ஏலங்கள்',
    management_reports: 'மேலாண்மை அறிக்கைகள்',
    orders: 'ஆர்டர்கள்',
    quality_analytics: 'தர பகுப்பாய்வு',
    start_live_auction: 'நேரடி ஏலத்தைத் தொடங்கு',
    wastage: 'விரயப் பதிவுகள்',
    receipts: 'ரசீதுகள்',
    outstanding_payments: 'நிலுவைக் கொடுப்பனவுகள்',
    confirm_receipt: 'ரசீதை உறுதிப்படுத்து',
    dispute_receipt: 'ரசீதை மறுக்க',
    cancel_appointment: 'சந்திப்பை ரத்து செய்',
    print: 'அச்சிடு',
    export_csv: 'CSV ஏற்றுமதி',
  },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  currentLanguageObj: LanguageOption;
  formatDate: (date: Date | string) => string;
  getRoleLabel: (roleKey: string) => string;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('hh_language') as Language;
    return saved && ['en', 'si', 'ta'].includes(saved) ? saved : 'en';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('hh_language', lang);
  };

  useEffect(() => {
    document.documentElement.lang = language;
    document.body.classList.remove('lang-en', 'lang-si', 'lang-ta');
    document.body.classList.add(`lang-${language}`);
  }, [language]);

  const t = (key: string): string => {
    return translations[language]?.[key] || translations['en']?.[key] || key;
  };

  const getRoleLabel = (roleKey: string): string => {
    if (!roleKey) return '';
    const key = `role_${roleKey}`;
    return translations[language]?.[key] || translations['en']?.[key] || roleKey.replace(/_/g, ' ');
  };

  const formatDate = (dateInput: Date | string): string => {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (isNaN(date.getTime())) return '';

    const localeMap: Record<Language, string> = {
      en: 'en-LK',
      si: 'si-LK',
      ta: 'ta-LK',
    };

    return date.toLocaleDateString(localeMap[language], {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const currentLanguageObj = LANGUAGES.find(l => l.code === language) || LANGUAGES[0];

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, currentLanguageObj, formatDate, getRoleLabel }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
