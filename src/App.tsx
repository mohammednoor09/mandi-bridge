/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from "react";
import { 
  Search, 
  MapPin, 
  TrendingUp, 
  Bell, 
  Info, 
  ChevronRight, 
  Phone, 
  ArrowUpRight, 
  ArrowDownRight,
  Filter,
  X,
  CheckCircle2,
  RefreshCw,
  Mic,
  MicOff,
  LogOut,
  Mail,
  Lock,
  User,
  ArrowRight
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from "recharts";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, parseISO } from "date-fns";
import ReactMarkdown from "react-markdown";
import { MOCK_MANDIS, CROPS, DISTRICTS, MOCK_FARMER_LISTINGS, CROP_IMAGES, BASE_PRICES } from "./constants";
import { Mandi, PriceRecord, PriceAlert, FarmerListing } from "./types";

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}
import { getMarketInsight, getFullMarketReport } from "./services/gemini";

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Fix Leaflet marker icon issue
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

// Component to center map on markers
function ChangeView({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  map.setView(center, zoom);
  return null;
}

const Logo = ({ className = "w-12 h-12", iconOnly = false, variant = "primary" }: { className?: string, iconOnly?: boolean, variant?: "primary" | "white" }) => (
  <div className={cn("flex flex-col items-center justify-center text-center gap-2", !iconOnly && "group")}>
    <div className={cn("relative flex items-center justify-center shrink-0", className)}>
      <div className={cn(
        "absolute inset-0 rounded-2xl transition-all duration-500 group-hover:rotate-12 group-hover:scale-110",
        variant === "primary" ? "bg-emerald-500 shadow-[0_4px_20px_rgba(16,185,129,0.3)]" : "bg-white"
      )} />
      <TrendingUp 
        className={cn("relative w-1/2 h-1/2 transition-transform duration-500 group-hover:scale-110", variant === "primary" ? "text-slate-950" : "text-slate-950")} 
        strokeWidth={3}
      />
    </div>
    {!iconOnly && (
      <div className="flex flex-col items-center">
        <span className={cn("text-xl font-black tracking-[-0.04em] leading-none uppercase", variant === "primary" ? "text-slate-950" : "text-white")}>
          Mandi <span className={variant === "primary" ? "text-emerald-600" : "text-emerald-400"}>Bridge</span>
        </span>
        <div className="flex items-center gap-1.5 mt-1">
          <span className={cn("text-[8px] font-black uppercase tracking-[0.4em] opacity-40", variant === "primary" ? "text-slate-900" : "text-white")}>
            Digital Hub
          </span>
        </div>
      </div>
    )}
  </div>
);

export default function App() {
  const [role, setRole] = useState<"seller" | "buyer">("seller");
  const [language, setLanguage] = useState<"en" | "kn" | "hi">("en");
  const [selectedDistrict, setSelectedDistrict] = useState(DISTRICTS[0]);
  const [selectedCrop, setSelectedCrop] = useState(CROPS[0]);
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [newAlert, setNewAlert] = useState({ crop: CROPS[0], price: 2500, condition: "below" as const });
  const [activeTab, setActiveTab] = useState<"list" | "map" | "trends">("list");
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState("");
  const [appliedSearchQuery, setAppliedSearchQuery] = useState("");
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authError, setAuthError] = useState("");
  const [authForm, setAuthForm] = useState({
    email: "",
    password: "",
    fullName: "",
    phoneNumber: ""
  });
  const [farmerListings, setFarmerListings] = useState<FarmerListing[]>(MOCK_FARMER_LISTINGS);
  const [showListStockModal, setShowListStockModal] = useState(false);
  const [newListing, setNewListing] = useState({
    farmerName: "",
    crop: CROPS[0],
    quantity: 0,
    price: BASE_PRICES[CROPS[0]],
    location: selectedDistrict,
    contact: ""
  });

  const [insight, setInsight] = useState("");
  const [isInsightLoading, setIsInsightLoading] = useState(false);
  const [fullReport, setFullReport] = useState("");
  const [isReportLoading, setIsReportLoading] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  const [quantityFilter, setQuantityFilter] = useState<number>(0);
  const [priceRange, setPriceRange] = useState<{ min: number; max: number }>({ min: 0, max: 10000 });

  // Helper to generate a deterministic price based on date, mandi, and crop
  const getDynamicPrice = (mandiId: string, crop: string, dateStr: string) => {
    const base = BASE_PRICES[crop] || 2000;
    // Simple hash function to create a deterministic variation
    const str = `${mandiId}-${crop}-${dateStr}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    // Variation between -5% and +5%
    const variation = (hash % 100) / 1000; 
    return Math.round(base * (1 + variation));
  };

  useEffect(() => {
    const fetchInsight = async () => {
      setIsInsightLoading(true);
      const data = await getMarketInsight(selectedCrop, selectedDistrict, role, language);
      setInsight(data);
      setIsInsightLoading(false);
    };
    fetchInsight();
  }, [selectedCrop, selectedDistrict, role, language]);

  // Filter mandis by district and search query
  const filteredMandis = useMemo(() => {
    const query = appliedSearchQuery.toLowerCase();
    return MOCK_MANDIS.filter(m => 
      m.district === selectedDistrict && 
      (m.name.toLowerCase().includes(query) || 
       selectedCrop.toLowerCase().includes(query))
    );
  }, [selectedDistrict, appliedSearchQuery, selectedCrop]);

  // Filter farmer listings by district, crop, quantity, price range and search query
  const filteredFarmerListings = useMemo(() => {
    const query = appliedSearchQuery.toLowerCase();
    return farmerListings.filter(f => 
      f.location.includes(selectedDistrict) && 
      f.crop === selectedCrop &&
      f.quantity >= quantityFilter &&
      f.price >= priceRange.min &&
      f.price <= priceRange.max &&
      (f.farmerName.toLowerCase().includes(query) || 
       f.location.toLowerCase().includes(query) ||
       f.crop.toLowerCase().includes(query))
    );
  }, [selectedDistrict, selectedCrop, farmerListings, quantityFilter, priceRange, appliedSearchQuery]);

  // Get current prices for selected crop and mandis
  const currentPrices = useMemo(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    return filteredMandis.map(mandi => {
      const price = getDynamicPrice(mandi.id, selectedCrop, today);
      return {
        ...mandi,
        price,
        date: today
      };
    }).sort((a, b) => b.price - a.price);
  }, [filteredMandis, selectedCrop]);

  // Mock historical data for trends
  const trendData = useMemo(() => {
    const data = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dateStr = format(d, "yyyy-MM-dd");
      data.push({
        date: format(d, "MMM dd"),
        price: getDynamicPrice(filteredMandis[0]?.id || "m1", selectedCrop, dateStr)
      });
    }
    return data;
  }, [selectedCrop, filteredMandis]);

  const handleReadFullReport = async () => {
    setShowReportModal(true);
    setIsReportLoading(true);
    const data = await getFullMarketReport(selectedCrop, selectedDistrict, role, language);
    setFullReport(data);
    setIsReportLoading(false);
  };

  const translations = {
    en: {
      seller: "SELLER",
      buyer: "BUYER",
      empowering: "Empowering Farmers",
      sourcing: "Sourcing Made Easy",
      liveStatus: "Live Status",
      updated: "Updated",
      selectDistrict: "Select District",
      selectCrop: "Select Crop",
      findPrices: "Find Best Prices",
      findStock: "Find Available Stock",
      priceList: "Price List",
      farmerListings: role === "seller" ? "Buyer Requirements" : "Farmer Listings",
      mandiMap: "Mandi Map",
      stockMap: "Stock Map",
      priceTrends: "Price Trends",
      location: "Karnataka, India",
      refresh: "Refresh Prices",
      setAlert: "Set Price Alert",
      marketInsight: "Market Insight",
      sourcingInsight: "Sourcing Insight",
      readReport: "Read Full Report",
      sellCrop: "Sell Your Crop",
      postRequirement: "Post Requirement",
      listStock: "List My Stock",
      postNeed: "List Crop Prices",
      needHelp: "Need Help?",
      helpTextSeller: "Contact our agricultural experts for selling advice.",
      helpTextBuyer: "Contact our sourcing agents for bulk procurement.",
      insightSeller: "Wheat prices in Yeshwanthpur are expected to rise by 5% next week due to lower supply.",
      insightBuyer: "Bulk buyers are moving to Mysore district for better quality Rice at competitive rates.",
      loadingInsight: "Analyzing market data...",
      sellText: "List your available stock to attract bulk buyers directly.",
      postText: "Post your bulk procurement needs to get quotes from farmers.",
      nearbyMandis: "Nearby Mandis in",
      farmersWith: "Farmers with",
      in: "in",
      pricesPerQuintal: "Prices per Quintal",
      availableStock: "Available Stock",
      bestPrice: "BEST PRICE",
      todaysPrice: "Today's Price",
      askingPrice: role === "seller" ? "Giving Price" : "Asking Price",
      quintalsAvailable: role === "seller" ? "Quintals Needed" : "Quintals Available",
      noFarmersFound: role === "seller" ? "No buyers listed for" : "No farmers listed for",
      yet: "yet",
      stockPoint: "Stock Point",
      bulkStockAvailable: "Bulk stock available here",
      priceTrend: "Price Trend",
      procurementTrend: "Procurement Trend",
      last7DaysIn: "Last 7 days in",
      priceAlerts: "Price Alerts",
      stockAlerts: "Stock Alerts",
      addNew: "+ Add New",
      noActiveAlerts: "No active alerts",
      below: "Below",
      above: "Above",
      privacyPolicy: "Privacy Policy",
      termsOfService: "Terms of Service",
      contactUs: "Contact Us",
      allRightsReserved: "All rights reserved.",
      crop: "Crop",
      condition: "Condition",
      price: "Price",
      createAlert: "Create Alert",
      listStockTitle: role === "seller" ? "List Your Stock" : "List Crop Prices",
      farmerName: role === "seller" ? "Farmer Name" : "Buyer Name",
      quantity: "Quantity (Quintals)",
      askingPriceForm: role === "seller" ? "Asking Price (₹/Quintal)" : "Giving Price (₹/Quintal)",
      locationForm: "Location",
      contactNumber: "Contact Number",
      submitListing: "Submit Listing",
      minQuantity: "Min Quantity",
      minPrice: "Min Price",
      maxPrice: "Max Price",
      filters: "Filters",
      phoneNumber: "Phone Number",
      password: "Password",
      login: "Login",
      signup: "Sign Up",
      fullName: "Full Name",
      welcomeBack: "Welcome back to the market",
      joinNetwork: "Join the farmer network",
      signIn: "Sign In",
      createAccount: "Create Account",
      orContinueWith: "Or continue with",
      crops: {
        "Wheat": "Wheat",
        "Rice": "Rice",
        "Maize": "Maize",
        "Cotton": "Cotton",
        "Soybean": "Soybean",
        "Onion": "Onion",
        "Potato": "Potato",
        "Tomato": "Tomato",
        "Mustard": "Mustard"
      },
      districts: {
        "Bangalore": "Bangalore",
        "Mysore": "Mysore",
        "Belgaum": "Belgaum",
        "Gulbarga": "Gulbarga",
        "Hubli-Dharwad": "Hubli-Dharwad",
        "Mangalore": "Mangalore",
        "Shimoga": "Shimoga",
        "Tumkur": "Tumkur"
      },
      mandis: {
        "Yeshwanthpur Mandi": "Yeshwanthpur Mandi",
        "K.R. Puram Mandi": "K.R. Puram Mandi",
        "Binny Mill Mandi": "Binny Mill Mandi",
        "Dasarahalli Mandi": "Dasarahalli Mandi",
        "Mysore APMC": "Mysore APMC",
        "Nanjangud APMC": "Nanjangud APMC",
        "Belgaum APMC": "Belgaum APMC",
        "Gokak APMC": "Gokak APMC",
        "Gulbarga Mandi": "Gulbarga Mandi",
        "Sedam Mandi": "Sedam Mandi",
        "Hubli APMC": "Hubli APMC",
        "Dharwad APMC": "Dharwad APMC",
        "Mangalore APMC": "Mangalore APMC",
        "Bantwal APMC": "Bantwal APMC",
        "Shimoga Mandi": "Shimoga Mandi",
        "Sagar APMC": "Sagar APMC",
        "Tumkur APMC": "Tumkur APMC",
        "Tiptur APMC": "Tiptur APMC",
        "Kunigal APMC": "Kunigal APMC"
      }
    },
    kn: {
      seller: "ಮಾರಾಟಗಾರ",
      buyer: "ಖರೀದಿದಾರ",
      empowering: "ರೈತರ ಸಬಲೀಕರಣ",
      sourcing: "ಸೋರ್ಸಿಂಗ್ ಸುಲಭವಾಗಿದೆ",
      liveStatus: "ಲೈವ್ ಸ್ಥಿತಿ",
      updated: "ನವೀಕರಿಸಲಾಗಿದೆ",
      selectDistrict: "ಜಿಲ್ಲೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ",
      selectCrop: "ಬೆಳೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ",
      findPrices: "ಅತ್ಯುತ್ತಮ ಬೆಲೆಗಳನ್ನು ಹುಡುಕಿ",
      findStock: "ಲಭ್ಯವಿರುವ ಸ್ಟಾಕ್ ಹುಡುಕಿ",
      priceList: "ಬೆಲೆ ಪಟ್ಟಿ",
      farmerListings: role === "seller" ? "ಖರೀದಿದಾರರ ಅಗತ್ಯತೆಗಳು" : "ರೈತರ ಪಟ್ಟಿಗಳು",
      mandiMap: "ಮಂಡಿ ನಕ್ಷೆ",
      stockMap: "ಸ್ಟಾಕ್ ನಕ್ಷೆ",
      priceTrends: "ಬೆಲೆ ಪ್ರವೃತ್ತಿಗಳು",
      location: "ಕರ್ನಾಟಕ, ಭಾರತ",
      refresh: "ಬೆಲೆಗಳನ್ನು ನವೀಕರಿಸಿ",
      setAlert: "ಬೆಲೆ ಎಚ್ಚರಿಕೆ ಹೊಂದಿಸಿ",
      marketInsight: "ಮಾರುಕಟ್ಟೆ ಒಳನೋಟ",
      sourcingInsight: "ಸೋರ್ಸಿಂಗ್ ಒಳನೋಟ",
      readReport: "ಪೂರ್ಣ ವರದಿಯನ್ನು ಓದಿ",
      sellCrop: "ನಿಮ್ಮ ಬೆಳೆಯನ್ನು ಮಾರಿ",
      postRequirement: "ಅಗತ್ಯವನ್ನು ಪೋಸ್ಟ್ ಮಾಡಿ",
      listStock: "ನನ್ನ ಸ್ಟಾಕ್ ಪಟ್ಟಿ ಮಾಡಿ",
      postNeed: "ಬೆಳೆ ಬೆಲೆಗಳನ್ನು ಪಟ್ಟಿ ಮಾಡಿ",
      needHelp: "ಸಹಾಯ ಬೇಕೇ?",
      helpTextSeller: "ಮಾರಾಟದ ಸಲಹೆಗಾಗಿ ನಮ್ಮ ಕೃಷಿ ತಜ್ಞರನ್ನು ಸಂಪರ್ಕಿಸಿ.",
      helpTextBuyer: "ಬೃಹತ್ ಸಂಗ್ರಹಣೆಗಾಗಿ ನಮ್ಮ ಸೋರ್ಸಿಂಗ್ ಏಜೆಂಟ್‌ಗಳನ್ನು ಸಂಪರ್ಕಿಸಿ.",
      insightSeller: "ಕಡಿಮೆ ಪೂರೈಕೆಯಿಂದಾಗಿ ಮುಂದಿನ ವಾರ ಯಶವಂತಪುರದಲ್ಲಿ ಗೋಧಿ ಬೆಲೆ ಶೇ.5ರಷ್ಟು ಏರಿಕೆಯಾಗುವ ನಿರೀಕ್ಷೆಯಿದೆ.",
      insightBuyer: "ಬೃಹತ್ ಖರೀದಿದಾರರು ಸ್ಪರ್ಧಾತ್ಮಕ ದರದಲ್ಲಿ ಉತ್ತಮ ಗುಣಮಟ್ಟದ ಅಕ್ಕಿಗಾಗಿ ಮೈಸೂರು ಜಿಲ್ಲೆಗೆ ತೆರಳುತ್ತಿದ್ದಾರೆ.",
      loadingInsight: "ಮಾರುಕಟ್ಟೆ ಡೇಟಾವನ್ನು ವಿಶ್ಲೇಷಿಸಲಾಗುತ್ತಿದೆ...",
      sellText: "ಬೃಹತ್ ಖರೀದಿದಾರರನ್ನು ನೇರವಾಗಿ ಆಕರ್ಷಿಸಲು ನಿಮ್ಮ ಲಭ್ಯವಿರುವ ಸ್ಟಾಕ್ ಅನ್ನು ಪಟ್ಟಿ ಮಾಡಿ.",
      postText: "ರೈತರಿಂದ ಉಲ್ಲೇಖಗಳನ್ನು ಪಡೆಯಲು ನಿಮ್ಮ ಬೃಹತ್ ಸಂಗ್ರಹಣೆ ಅಗತ್ಯಗಳನ್ನು ಪೋಸ್ಟ್ ಮಾಡಿ.",
      nearbyMandis: "ಹತ್ತಿರದ ಮಂಡಿಗಳು",
      farmersWith: "ರೈತರು",
      in: "ನಲ್ಲಿ",
      pricesPerQuintal: "ಪ್ರತಿ ಕ್ವಿಂಟಾಲ್ ಬೆಲೆ",
      availableStock: "ಲಭ್ಯವಿರುವ ಸ್ಟಾಕ್",
      bestPrice: "ಅತ್ಯುತ್ತಮ ಬೆಲೆ",
      todaysPrice: "ಇಂದಿನ ಬೆಲೆ",
      askingPrice: role === "seller" ? "ನೀಡುವ ಬೆಲೆ" : "ಕೇಳುವ ಬೆಲೆ",
      quintalsAvailable: role === "seller" ? "ಕ್ವಿಂಟಾಲ್ ಅಗತ್ಯವಿದೆ" : "ಕ್ವಿಂಟಾಲ್ ಲಭ್ಯವಿದೆ",
      noFarmersFound: role === "seller" ? "ಯಾವುದೇ ಖರೀದಿದಾರರು ಪಟ್ಟಿಯಾಗಿಲ್ಲ" : "ಯಾವುದೇ ರೈತರು ಪಟ್ಟಿಯಾಗಿಲ್ಲ",
      yet: "ಇನ್ನೂ",
      stockPoint: "ಸ್ಟಾಕ್ ಪಾಯಿಂಟ್",
      bulkStockAvailable: "ಇಲ್ಲಿ ಬೃಹತ್ ಸ್ಟಾಕ್ ಲಭ್ಯವಿದೆ",
      priceTrend: "ಬೆಲೆ ಪ್ರವೃತ್ತಿ",
      procurementTrend: "ಸಂಗ್ರಹಣೆ ಪ್ರವೃತ್ತಿ",
      last7DaysIn: "ಕಳೆದ 7 ದಿನಗಳಲ್ಲಿ",
      priceAlerts: "ಬೆಲೆ ಎಚ್ಚರಿಕೆಗಳು",
      stockAlerts: "ಸ್ಟಾಕ್ ಎಚ್ಚರಿಕೆಗಳು",
      addNew: "+ ಹೊಸದನ್ನು ಸೇರಿಸಿ",
      noActiveAlerts: "ಯಾವುದೇ ಸಕ್ರಿಯ ಎಚ್ಚರಿಕೆಗಳಿಲ್ಲ",
      below: "ಕೆಳಗೆ",
      above: "ಮೇಲೆ",
      privacyPolicy: "ಗೌಪ್ಯತಾ ನೀತಿ",
      termsOfService: "ಸೇವಾ ನಿಯಮಗಳು",
      contactUs: "ನಮ್ಮನ್ನು ಸಂಪರ್ಕಿಸಿ",
      allRightsReserved: "ಎಲ್ಲಾ ಹಕ್ಕುಗಳನ್ನು ಕಾಯ್ದಿರಿಸಲಾಗಿದೆ.",
      crop: "ಬೆಳೆ",
      condition: "ಸ್ಥಿತಿ",
      price: "ಬೆಲೆ",
      createAlert: "ಎಚ್ಚರಿಕೆ ರಚಿಸಿ",
      listStockTitle: role === "seller" ? "ನಿಮ್ಮ ಸ್ಟಾಕ್ ಪಟ್ಟಿ ಮಾಡಿ" : "ಬೆಳೆ ಬೆಲೆಗಳನ್ನು ಪಟ್ಟಿ ಮಾಡಿ",
      farmerName: role === "seller" ? "ರೈತರ ಹೆಸರು" : "ಖರೀದಿದಾರರ ಹೆಸರು",
      quantity: "ಪ್ರಮಾಣ (ಕ್ವಿಂಟಾಲ್)",
      askingPriceForm: role === "seller" ? "ಕೇಳುವ ಬೆಲೆ (₹/ಕ್ವಿಂಟಾಲ್)" : "ನೀಡುವ ಬೆಲೆ (₹/ಕ್ವಿಂಟಾಲ್)",
      locationForm: "ಸ್ಥಳ",
      contactNumber: "ಸಂಪರ್ಕ ಸಂಖ್ಯೆ",
      submitListing: "ಪಟ್ಟಿಯನ್ನು ಸಲ್ಲಿಸಿ",
      minQuantity: "ಕನಿಷ್ಠ ಪ್ರಮಾಣ",
      minPrice: "ಕನಿಷ್ಠ ಬೆಲೆ",
      maxPrice: "ಗರಿಷ್ಠ ಬೆಲೆ",
      filters: "ಫಿಲ್ಟರ್‌ಗಳು",
      phoneNumber: "ಫೋನ್ ಸಂಖ್ಯೆ",
      password: "ಪಾಸ್ವರ್ಡ್",
      login: "ಲಾಗಿನ್",
      signup: "ಸೈನ್ ಅಪ್",
      fullName: "ಪೂರ್ಣ ಹೆಸರು",
      welcomeBack: "ಮಾರುಕಟ್ಟೆಗೆ ಮರಳಿ ಸ್ವಾಗತ",
      joinNetwork: "ರೈತ ಜಾಲಕ್ಕೆ ಸೇರಿ",
      signIn: "ಸೈನ್ ಇನ್",
      createAccount: "ಖಾತೆ ರಚಿಸಿ",
      orContinueWith: "ಅಥವಾ ಇದರೊಂದಿಗೆ ಮುಂದುವರಿಯಿರಿ",
      crops: {
        "Wheat": "ಗೋಧಿ",
        "Rice": "ಅಕ್ಕಿ",
        "Maize": "ಮೆಕ್ಕೆಜೋಳ",
        "Cotton": "ಹತ್ತಿ",
        "Soybean": "ಸೋಯಾಬೀನ್",
        "Onion": "ಈರುಳ್ಳಿ",
        "Potato": "ಆಲೂಗಡ್ಡೆ",
        "Tomato": "ಟೊಮೆಟೊ",
        "Mustard": "ಸಾಸಿವೆ"
      },
      districts: {
        "Bangalore": "ಬೆಂಗಳೂರು",
        "Mysore": "ಮೈಸೂರು",
        "Belgaum": "ಬೆಳಗಾವಿ",
        "Gulbarga": "ಗುಲ್ಬರ್ಗ",
        "Hubli-Dharwad": "ಹುಬ್ಬಳ್ಳಿ-ಧಾರವಾಡ",
        "Mangalore": "ಮಂಗಳೂರು",
        "Shimoga": "ಶಿವಮೊಗ್ಗ",
        "Tumkur": "ತುಮಕೂರು"
      },
      mandis: {
        "Yeshwanthpur Mandi": "ಯಶವಂತಪುರ ಮಂಡಿ",
        "K.R. Puram Mandi": "ಕೆ.ಆರ್. ಪುರಂ ಮಂಡಿ",
        "Binny Mill Mandi": "ಬಿನ್ನಿ ಮಿಲ್ ಮಂಡಿ",
        "Dasarahalli Mandi": "ದಾಸರಹಳ್ಳಿ ಮಂಡಿ",
        "Mysore APMC": "ಮೈಸೂರು ಎಪಿಎಂಸಿ",
        "Nanjangud APMC": "ನಂಜನಗೂಡು ಎಪಿಎಂಸಿ",
        "Belgaum APMC": "ಬೆಳಗಾವಿ ಎಪಿಎಂಸಿ",
        "Gokak APMC": "ಗೋಕಾಕ್ ಎಪಿಎಂಸಿ",
        "Gulbarga Mandi": "ಗುಲ್ಬರ್ಗ ಮಂಡಿ",
        "Sedam Mandi": "ಸೇಡಂ ಮಂಡಿ",
        "Hubli APMC": "ಹುಬ್ಬಳ್ಳಿ ಎಪಿಎಂಸಿ",
        "Dharwad APMC": "ಧಾರವಾಡ ಎಪಿಎಂಸಿ",
        "Mangalore APMC": "ಮಂಗಳೂರು ಎಪಿಎಂಸಿ",
        "Bantwal APMC": "ಬಂಟ್ವಾಳ ಎಪಿಎಂಸಿ",
        "Shimoga Mandi": "ಶಿವಮೊಗ್ಗ ಮಂಡಿ",
        "Sagar APMC": "ಸಾಗರ ಎಪಿಎಂಸಿ",
        "Tumkur APMC": "ತುಮಕೂರು ಎಪಿಎಂಸಿ",
        "Tiptur APMC": "ತಿಪಟೂರು ಎಪಿಎಂಸಿ",
        "Kunigal APMC": "ಕುಣಿಗಲ್ ಎಪಿಎಂಸಿ"
      }
    },
    hi: {
      seller: "विक्रेता",
      buyer: "खरीददार",
      empowering: "किसानों का सशक्तिकरण",
      sourcing: "सोर्सिंग आसान हो गई",
      liveStatus: "लाइव स्थिति",
      updated: "अपडेट किया गया",
      selectDistrict: "जिला चुनें",
      selectCrop: "फसल चुनें",
      findPrices: "सर्वोत्तम कीमतें खोजें",
      findStock: "उपलब्ध स्टॉक खोजें",
      priceList: "मूल्य सूची",
      farmerListings: role === "seller" ? "खरीददार की आवश्यकताएं" : "किसान लिस्टिंग",
      mandiMap: "मंडी मानचित्र",
      stockMap: "स्टॉक मानचित्र",
      priceTrends: "मूल्य रुझान",
      location: "कर्नाटक, भारत",
      refresh: "कीमतें अपडेट करें",
      setAlert: "मूल्य अलर्ट सेट करें",
      marketInsight: "बाजार अंतर्दृष्टि",
      sourcingInsight: "सोर्सिंग अंतर्दृष्टि",
      readReport: "पूरी रिपोर्ट पढ़ें",
      sellCrop: "अपनी फसल बेचें",
      postRequirement: "आवश्यकता पोस्ट करें",
      listStock: "मेरा स्टॉक सूचीबद्ध करें",
      postNeed: "फसल की कीमतें सूचीबद्ध करें",
      needHelp: "मदद चाहिए?",
      helpTextSeller: "बिक्री सलाह के लिए हमारे कृषि विशेषज्ञों से संपर्क करें।",
      helpTextBuyer: "थोक खरीद के लिए हमारे सोर्सिंग एजेंटों से संपर्क करें।",
      insightSeller: "कम आपूर्ति के कारण अगले सप्ताह यशवंतपुर में गेहूं की कीमतों में 5% की वृद्धि होने की उम्मीद है।",
      insightBuyer: "थोक खरीदार प्रतिस्पर्धी दरों पर बेहतर गुणवत्ता वाले चावल के लिए मैसूर जिले की ओर रुख कर रहे हैं।",
      loadingInsight: "बाजार डेटा का विश्लेषण किया जा रहा है...",
      sellText: "थोक खरीदारों को सीधे आकर्षित करने के लिए अपने उपलब्ध स्टॉक को सूचीबद्ध करें।",
      postText: "किसानों से उद्धरण प्राप्त करने के लिए अपनी थोक खरीद आवश्यकताओं को पोस्ट करें।",
      nearbyMandis: "निकटतम मंडियां",
      farmersWith: "किसान",
      in: "में",
      pricesPerQuintal: "प्रति क्विंटल कीमतें",
      availableStock: "उपलब्ध स्टॉक",
      bestPrice: "सर्वोत्तम मूल्य",
      todaysPrice: "आज की कीमत",
      askingPrice: role === "seller" ? "दी जाने वाली कीमत" : "पूछी गई कीमत",
      quintalsAvailable: role === "seller" ? "क्विंटल की आवश्यकता" : "क्विंटल उपलब्ध",
      noFarmersFound: role === "seller" ? "कोई खरीददार सूचीबद्ध नहीं है" : "कोई किसान सूचीबद्ध नहीं है",
      yet: "अभी तक",
      stockPoint: "स्टॉक पॉइंट",
      bulkStockAvailable: "थोक स्टॉक यहाँ उपलब्ध है",
      priceTrend: "मूल्य रुझान",
      procurementTrend: "खरीद रुझान",
      last7DaysIn: "पिछले 7 दिनों में",
      priceAlerts: "मूल्य अलर्ट",
      stockAlerts: "स्टॉक अलर्ट",
      addNew: "+ नया जोड़ें",
      noActiveAlerts: "कोई सक्रिय अलर्ट नहीं",
      below: "नीचे",
      above: "ऊपर",
      privacyPolicy: "गोपनीयता नीति",
      termsOfService: "सेवा की शर्तें",
      contactUs: "संपर्क करें",
      allRightsReserved: "सर्वाधिकार सुरक्षित।",
      crop: "फसल",
      condition: "शर्त",
      price: "कीमत",
      createAlert: "अलर्ट बनाएं",
      listStockTitle: role === "seller" ? "अपना स्टॉक सूचीबद्ध करें" : "फसल की कीमतें सूचीबद्ध करें",
      farmerName: role === "seller" ? "किसान का नाम" : "खरीददार का नाम",
      quantity: "मात्रा (क्विंटल)",
      askingPriceForm: role === "seller" ? "पूछी गई कीमत (₹/क्विंटल)" : "दी जाने वाली कीमत (₹/क्विंटल)",
      locationForm: "स्थान",
      contactNumber: "संपर्क नंबर",
      submitListing: "लिस्टिंग जमा करें",
      minQuantity: "न्यूनतम मात्रा",
      minPrice: "न्यूनतम मूल्य",
      maxPrice: "अधिकतम मूल्य",
      filters: "फ़िल्टर",
      phoneNumber: "फ़ोन नंबर",
      password: "पासवर्ड",
      login: "लॉगिन",
      signup: "साइन अप",
      fullName: "पूरा नाम",
      welcomeBack: "बाजार में आपका स्वागत है",
      joinNetwork: "किसान नेटवर्क से जुड़ें",
      signIn: "साइन इन करें",
      createAccount: "खाता बनाएं",
      orContinueWith: "या इसके साथ जारी रखें",
      crops: {
        "Wheat": "गेहूं",
        "Rice": "चावल",
        "Maize": "मक्का",
        "Cotton": "कपास",
        "Soybean": "सोयाबीन",
        "Onion": "प्याज",
        "Potato": "आलू",
        "Tomato": "टमाटर",
        "Mustard": "सरसों"
      },
      districts: {
        "Bangalore": "बेंगलुरु",
        "Mysore": "मैसूर",
        "Belgaum": "बेलगाम",
        "Gulbarga": "गुलबर्गा",
        "Hubli-Dharwad": "हुबली-धारवाड़",
        "Mangalore": "मंगलौर",
        "Shimoga": "शिमोगा",
        "Tumkur": "तुमकुर"
      },
      mandis: {
        "Yeshwanthpur Mandi": "यशवंतपुर मंडी",
        "K.R. Puram Mandi": "के.आर. पुरम मंडी",
        "Binny Mill Mandi": "बिन्नी मिल मंडी",
        "Dasarahalli Mandi": "दसरहल्ली मंडी",
        "Mysore APMC": "मैसूर एपीएमसी",
        "Nanjangud APMC": "नंजनगुड एपीएमसी",
        "Belgaum APMC": "बेलगाम एपीएमसी",
        "Gokak APMC": "गोकक एपीएमसी",
        "Gulbarga Mandi": "गुलबर्गा मंडी",
        "Sedam Mandi": "सेडम मंडी",
        "Hubli APMC": "हुबली एपीएमसी",
        "Dharwad APMC": "धारवाड़ एपीएमसी",
        "Mangalore APMC": "मंगलौर एपीएमसी",
        "Bantwal APMC": "बंटवाल एपीएमसी",
        "Shimoga Mandi": "शिमोगा मंडी",
        "Sagar APMC": "सागर एपीएमसी",
        "Tumkur APMC": "तुमकुर मंडी",
        "Tiptur APMC": "तिपटूर एपीएमसी",
        "Kunigal APMC": "कुनिगल एपीएमसी"
      }
    }
  };

  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in your browser. Please try Chrome or Edge.");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = language === "en" ? "en-US" : language === "kn" ? "kn-IN" : "hi-IN";
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsListening(true);
        console.log("Speech recognition started");
      };
      
      recognition.onend = () => {
        setIsListening(false);
        console.log("Speech recognition ended");
      };
      
      recognition.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        setIsListening(false);
        if (event.error === 'not-allowed') {
          alert("Microphone access denied. Please enable microphone permissions in your browser settings.");
        }
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        console.log("Speech recognized:", transcript);
        setSearchQuery(transcript);
        
        const query = transcript.trim();
        const matchedCrop = CROPS.find(c => c.toLowerCase() === query.toLowerCase());
        const matchedDistrict = DISTRICTS.find(d => d.toLowerCase() === query.toLowerCase());
        
        if (matchedCrop) setSelectedCrop(matchedCrop);
        if (matchedDistrict) setSelectedDistrict(matchedDistrict);
        
        setAppliedSearchQuery(query);
        if (showMobileSearch) setShowMobileSearch(false);
      };

      recognition.start();
    } catch (error) {
      console.error("Error starting speech recognition:", error);
      setIsListening(false);
    }
  };

  const t = translations[language];

  const mapCenter: [number, number] = filteredMandis.length > 0 
    ? [filteredMandis[0].lat, filteredMandis[0].lng] 
    : [12.9716, 77.5946];

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-white flex flex-col lg:flex-row overflow-hidden font-sans selection:bg-emerald-100 selection:text-emerald-900">
        {/* Left Branding Panel */}
        <div className="hidden lg:flex w-[42%] bg-[#021a14] relative overflow-hidden flex-col justify-between p-16 xl:p-20">
          {/* Technical Grid Background */}
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(#334155 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
          
          <div className="absolute inset-0">
            <motion.div 
              animate={{ 
                opacity: [0.1, 0.3, 0.1]
              }}
              transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
              className="absolute top-1/4 -right-20 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[120px]" 
            />
          </div>
          
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative z-10"
          >
            <Logo variant="white" className="scale-110 origin-left" />
          </motion.div>

          <div className="relative z-10 space-y-10">
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h1 className="text-6xl xl:text-8xl font-serif text-white leading-[0.9] tracking-tighter">
                Precision <br /> 
                <span className="italic text-emerald-500 font-light italic-serif-alt underline decoration-emerald-500/30 underline-offset-[12px]">market</span> <br /> 
                Intelligence.
              </h1>
              <p className="mt-8 text-slate-400 text-lg font-medium max-w-sm leading-relaxed">
                Empowering Karnataka's farmers with real-time price transparency and seamless mandi access.
              </p>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="grid grid-cols-3 gap-8 pt-10 border-t border-white/5"
            >
              <div className="space-y-1">
                <div className="text-3xl font-serif text-white font-bold tabular-nums">450+</div>
                <div className="text-[9px] text-emerald-500/80 font-black uppercase tracking-[0.25em]">Mandis</div>
              </div>
              <div className="space-y-1">
                <div className="text-3xl font-serif text-white font-bold tabular-nums">12k</div>
                <div className="text-[9px] text-emerald-500/80 font-black uppercase tracking-[0.25em]">Farmers</div>
              </div>
              <div className="space-y-1">
                <div className="text-3xl font-serif text-white font-bold tabular-nums">Live</div>
                <div className="text-[9px] text-emerald-500/80 font-black uppercase tracking-[0.25em]">Analytics</div>
              </div>
            </motion.div>
          </div>

          <div className="relative z-10 flex items-center gap-4 text-white/10 text-[9px] font-black uppercase tracking-[0.4em]">
            <span>MandiBridge Enterprise</span>
            <div className="w-1 h-1 bg-white/10 rounded-full" />
            <span>Karnataka v2.4</span>
          </div>
        </div>

        {/* Right Form Panel */}
        <div className="flex-1 flex flex-col justify-center p-6 sm:p-12 lg:p-24 bg-slate-50/50 relative overflow-hidden">
          {/* Subtle background decoration */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

          <div className="w-full max-w-sm mx-auto relative z-10 text-center lg:text-left">
            <div className="mb-12 flex flex-col items-center lg:items-start text-center lg:text-left group">
              <div className="mb-6">
                <Logo iconOnly className="scale-125" />
              </div>
              <div className="space-y-1.5">
                <h2 className="text-4xl font-serif font-black tracking-tight text-slate-900 leading-none uppercase">
                  Mandi <span className="text-emerald-600">Bridge</span>
                </h2>
                <div className="flex items-center justify-center lg:justify-start gap-2">
                  <div className="h-[1px] w-4 bg-emerald-500/30" />
                  <p className="text-[10px] font-black uppercase tracking-[0.4em] text-emerald-600/60">
                    Market Access
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3 mb-10">
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase tracking-wider border border-emerald-100"
              >
                <div className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse" />
                Network Status: Active
              </motion.div>
              <p className="text-slate-500 text-sm max-w-xs">
                Initialize your secure connection to the agricultural network of Karnataka.
              </p>
            </div>

            {/* Premium Role Toggle */}
            <div className="flex bg-slate-200/50 p-1 rounded-2xl border border-slate-200/60 mb-10">
              <button 
                onClick={() => setRole("seller")}
                className={cn(
                  "flex-1 py-3 text-[10px] font-black rounded-xl transition-all uppercase tracking-[0.15em] flex items-center justify-center gap-2",
                  role === "seller" ? "bg-white text-slate-900 shadow-sm border border-slate-100" : "text-slate-400 hover:text-slate-600"
                )}
              >
                {t.seller}
              </button>
              <button 
                onClick={() => setRole("buyer")}
                className={cn(
                  "flex-1 py-3 text-[10px] font-black rounded-xl transition-all uppercase tracking-[0.15em] flex items-center justify-center gap-2",
                  role === "buyer" ? "bg-white text-slate-900 shadow-sm border border-slate-100" : "text-slate-400 hover:text-slate-600"
                )}
              >
                {t.buyer}
              </button>
            </div>

            <form 
              onSubmit={(e) => {
                e.preventDefault();
                setAuthError("");
                if (authMode === "login") {
                  if (authForm.email === "admin@mandibridge" && authForm.password === "Mandi@123") {
                    setIsAuthenticated(true);
                  } else {
                    setAuthError("Invalid identity or encryption key. Please check your credentials.");
                  }
                } else {
                  // For signup, we'll just allow it for demo purposes, 
                  // or we can just say signups are disabled in this mode
                  setIsAuthenticated(true);
                }
              }}
              className="space-y-5"
            >
              {authError && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="bg-red-50 border border-red-100 text-red-600 text-[10px] font-bold p-3 rounded-xl flex items-center gap-2"
                >
                  <div className="w-1.5 h-1.5 bg-red-500 rounded-full shrink-0" />
                  {authError}
                </motion.div>
              )}
              {authMode === "signup" && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-2 group"
                >
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] flex items-center gap-2 group-focus-within:text-emerald-600 transition-colors">
                    <User size={12} className="opacity-50" /> Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={authForm.fullName}
                    onChange={(e) => setAuthForm({ ...authForm, fullName: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 text-sm focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500/50 outline-none transition-all placeholder:text-slate-300"
                    placeholder="Enter your full name"
                  />
                </motion.div>
              )}

              <div className="space-y-2 group">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] flex items-center gap-2 group-focus-within:text-emerald-600 transition-colors">
                  <Mail size={12} className="opacity-50" /> Identity / Phone
                </label>
                <input
                  type="text"
                  required
                  value={authForm.email}
                  onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 text-sm focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500/50 outline-none transition-all placeholder:text-slate-300"
                  placeholder="e.g. 9845012345"
                />
              </div>

              <div className="space-y-2 group">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] flex items-center gap-2 group-focus-within:text-emerald-600 transition-colors">
                    <Lock size={12} className="opacity-50" /> Encryption Key
                  </label>
                  {authMode === "login" && (
                    <button type="button" className="text-[9px] font-black uppercase text-slate-400 hover:text-emerald-700 tracking-wider">
                      Recovery
                    </button>
                  )}
                </div>
                <input
                  type="password"
                  required
                  value={authForm.password}
                  onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 text-sm focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500/50 outline-none transition-all placeholder:text-slate-300"
                  placeholder="••••••••"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full bg-[#052c21] text-white rounded-2xl py-5 font-black uppercase tracking-[0.3em] text-[10px] flex items-center justify-center gap-3 hover:bg-[#021a14] transition-all shadow-xl shadow-emerald-950/20 active:scale-[0.98] group"
                >
                  {authMode === "login" ? "Initialize Session" : "Deploy Account"}
                  <ArrowRight size={14} className="text-emerald-500 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </form>

            <div className="mt-12 flex flex-col items-center gap-6">
              <div className="flex items-center gap-4 w-full">
                <div className="h-px bg-slate-200 flex-1" />
                <span className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em] whitespace-nowrap">Locale Localization</span>
                <div className="h-px bg-slate-200 flex-1" />
              </div>
              
              <div className="flex gap-4">
                {["en", "kn", "hi"].map((l) => (
                  <button
                    key={l}
                    onClick={() => setLanguage(l as any)}
                    className={cn(
                      "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all",
                      language === l ? "bg-emerald-50 text-emerald-700 font-black" : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    {l === "en" ? "ENG" : l === "kn" ? "KAN" : "HIN"}
                  </button>
                ))}
              </div>

              <div className="pt-4 flex flex-col items-center gap-1 text-center">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-2">
                  {authMode === "login" ? "New to the hub?" : "Already verified?"}
                </p>
                <button 
                  onClick={() => {
                    setAuthMode(authMode === "login" ? "signup" : "login");
                    setAuthError("");
                  }}
                  className="text-slate-900 font-black text-[10px] uppercase tracking-[0.25em] hover:text-emerald-700 transition-colors border-b-2 border-emerald-500/20 hover:border-emerald-500 pb-0.5"
                >
                  {authMode === "login" ? "Create farmer node" : "Access existing port"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleAddAlert = () => {
    const alert: PriceAlert = {
      id: Math.random().toString(36).substr(2, 9),
      crop: newAlert.crop,
      targetPrice: newAlert.price,
      condition: newAlert.condition,
      active: true
    };
    setAlerts([...alerts, alert]);
    setShowAlertModal(false);
  };

  const handleAddListing = () => {
    const listing: FarmerListing = {
      id: Math.random().toString(36).substr(2, 9),
      farmerName: newListing.farmerName,
      crop: newListing.crop,
      quantity: newListing.quantity,
      price: newListing.price,
      location: newListing.location,
      contact: newListing.contact,
      date: format(new Date(), "yyyy-MM-dd")
    };
    setFarmerListings([listing, ...farmerListings]);
    setShowListStockModal(false);
    setNewListing({
      ...newListing,
      farmerName: "",
      quantity: 0,
      contact: ""
    });
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      {/* Role Switcher - Left Corner (Floating for Mobile) */}
      <div className="fixed bottom-6 left-6 z-[100] sm:top-24 sm:left-8 sm:bottom-auto">
        <p className="text-[10px] font-black text-zinc-400 mb-2 ml-2 tracking-widest uppercase hidden sm:block">Switch Mode</p>
        <div className="bg-white rounded-3xl shadow-2xl border border-zinc-200 p-2 flex flex-col gap-2 backdrop-blur-md bg-white/90">
          <button 
            onClick={() => setRole("seller")}
            className={cn(
              "flex flex-col items-center justify-center w-16 h-16 rounded-2xl transition-all duration-300",
              role === "seller" 
                ? "bg-primary text-white shadow-lg shadow-primary/30 scale-105" 
                : "text-zinc-400 hover:bg-zinc-50 hover:text-zinc-600"
            )}
          >
            <Logo className="w-6 h-6" iconOnly variant={role === "seller" ? "white" : "primary"} />
            <span className="text-[10px] font-bold mt-1 uppercase">{t.seller}</span>
          </button>
          <div className="h-px w-8 bg-zinc-100 mx-auto"></div>
          <button 
            onClick={() => setRole("buyer")}
            className={cn(
              "flex flex-col items-center justify-center w-16 h-16 rounded-2xl transition-all duration-300",
              role === "buyer" 
                ? "bg-primary text-white shadow-lg shadow-primary/30 scale-105" 
                : "text-zinc-400 hover:bg-zinc-50 hover:text-zinc-600"
            )}
          >
            <Search size={20} />
            <span className="text-[10px] font-bold mt-1 uppercase">{t.buyer}</span>
          </button>
        </div>
      </div>

      {/* Header */}
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {!showMobileSearch && <Logo />}
          
          <div className={cn(
            "flex-1 max-w-md transition-all duration-300",
            showMobileSearch ? "block" : "hidden sm:block"
          )}>
            <div className="relative group flex items-center">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={16} className="text-zinc-400 group-focus-within:text-primary transition-colors" />
              </div>
              <input
                type="text"
                value={searchQuery}
                autoFocus={showMobileSearch}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const query = searchQuery.trim();
                    const matchedCrop = CROPS.find(c => c.toLowerCase() === query.toLowerCase());
                    const matchedDistrict = DISTRICTS.find(d => d.toLowerCase() === query.toLowerCase());
                    
                    if (matchedCrop) setSelectedCrop(matchedCrop);
                    if (matchedDistrict) setSelectedDistrict(matchedDistrict);
                    
                    setAppliedSearchQuery(query);
                    if (showMobileSearch) setShowMobileSearch(false);
                  }
                }}
                placeholder={role === "seller" ? "Search mandis or crops..." : "Search buyers or stock..."}
                className="block w-full pl-10 pr-32 py-2 border border-zinc-200 rounded-xl leading-5 bg-zinc-50 placeholder-zinc-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary sm:text-sm transition-all"
              />
              <div className="absolute right-1.5 flex items-center gap-1">
                <button 
                  onClick={startListening}
                  className={cn(
                    "p-1.5 rounded-lg transition-all",
                    isListening ? "bg-red-500 text-white animate-pulse" : "text-zinc-400 hover:text-primary hover:bg-zinc-100"
                  )}
                  title="Voice Search"
                >
                  {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                </button>
                {searchQuery && (
                  <button 
                    onClick={() => {
                      setSearchQuery("");
                      setAppliedSearchQuery("");
                    }}
                    className="p-1 text-zinc-400 hover:text-zinc-600 transition-colors"
                  >
                    <X size={16} />
                  </button>
                )}
                <button 
                  onClick={() => {
                    const query = searchQuery.trim();
                    const matchedCrop = CROPS.find(c => c.toLowerCase() === query.toLowerCase());
                    const matchedDistrict = DISTRICTS.find(d => d.toLowerCase() === query.toLowerCase());
                    
                    if (matchedCrop) setSelectedCrop(matchedCrop);
                    if (matchedDistrict) setSelectedDistrict(matchedDistrict);

                    setAppliedSearchQuery(query);
                    if (showMobileSearch) setShowMobileSearch(false);
                  }}
                  className="bg-primary text-white p-1.5 rounded-lg hover:bg-emerald-600 transition-all shadow-sm active:scale-95"
                  title="Search"
                >
                  <Search size={14} />
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            {!showMobileSearch && (
              <button 
                onClick={() => setShowMobileSearch(true)}
                className="sm:hidden p-2 text-zinc-500 hover:text-primary hover:bg-primary-light rounded-full transition-colors"
              >
                <Search size={20} />
              </button>
            )}
            <div className="hidden md:flex flex-col items-end mr-2">
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{t.liveStatus}</p>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                <p className="text-[10px] font-bold text-zinc-600">{t.updated}: {format(lastUpdated, "HH:mm:ss")}</p>
              </div>
            </div>
            <button 
              onClick={() => {
                setLastUpdated(new Date());
              }}
              className="p-2 text-zinc-500 hover:text-primary hover:bg-primary-light rounded-full transition-colors"
              title={t.refresh}
            >
              <RefreshCw size={20} className={cn(lastUpdated && "transition-transform hover:rotate-180 duration-500")} />
            </button>
            <button 
              onClick={() => setShowAlertModal(true)}
              className="p-2 text-zinc-500 hover:text-primary hover:bg-primary-light rounded-full transition-colors relative"
              title={t.setAlert}
            >
              <Bell size={20} />
              {alerts.length > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
              )}
            </button>
            <button 
              onClick={() => setIsAuthenticated(false)}
              className="p-2 text-zinc-500 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors ml-1"
              title="Logout"
            >
              <LogOut size={20} />
            </button>
            <div className="hidden sm:block h-8 w-px bg-zinc-200"></div>
            <div className="flex items-center gap-2">
              <select 
                value={language}
                onChange={(e) => setLanguage(e.target.value as "en" | "kn" | "hi")}
                className="bg-zinc-50 border border-zinc-200 rounded-lg px-2 py-1 text-[10px] font-bold focus:ring-1 focus:ring-primary/20 outline-none cursor-pointer"
              >
                <option value="en">EN</option>
                <option value="kn">ಕನ್ನಡ</option>
                <option value="hi">हिंदी</option>
              </select>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 sm:pl-32">
        {/* Search & Filters */}
        <section className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                <MapPin size={14} className="text-primary" />
                {t.selectDistrict}
              </label>
              <select 
                value={selectedDistrict}
                onChange={(e) => setSelectedDistrict(e.target.value)}
                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
              >
                {DISTRICTS.map(d => <option key={d} value={d}>{t.districts[d] || d}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                <Filter size={14} className="text-primary" />
                {t.selectCrop}
              </label>
              <div className="flex gap-3">
                <div className="w-12 h-12 rounded-xl border border-zinc-200 overflow-hidden flex-shrink-0 bg-white">
                  <img 
                    src={CROP_IMAGES[selectedCrop]} 
                    alt={selectedCrop}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <select 
                  value={selectedCrop}
                  onChange={(e) => setSelectedCrop(e.target.value)}
                  className="flex-1 bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                >
                  {CROPS.map(c => <option key={c} value={c}>{t.crops[c] || c}</option>)}
                </select>
              </div>
            </div>
            <div className="flex items-end">
              <button className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-3 px-6 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-primary/20">
                <Search size={18} />
                {role === "seller" ? t.findPrices : t.findStock}
              </button>
            </div>
          </div>
        </section>

        {/* Tabs */}
        <div className="flex items-center gap-2 mb-6 bg-zinc-200/50 p-1 rounded-xl w-fit">
          <button 
            onClick={() => setActiveTab("list")}
            className={cn(
              "px-4 py-2 rounded-lg text-xs font-bold transition-all",
              activeTab === "list" ? "bg-white text-primary shadow-sm" : "text-zinc-500 hover:text-zinc-700"
            )}
          >
            {role === "seller" ? t.priceList : t.farmerListings}
          </button>
          <button 
            onClick={() => setActiveTab("map")}
            className={cn(
              "px-4 py-2 rounded-lg text-xs font-bold transition-all",
              activeTab === "map" ? "bg-white text-primary shadow-sm" : "text-zinc-500 hover:text-zinc-700"
            )}
          >
            {role === "seller" ? t.mandiMap : t.stockMap}
          </button>
          <button 
            onClick={() => setActiveTab("trends")}
            className={cn(
              "px-4 py-2 rounded-lg text-xs font-bold transition-all",
              activeTab === "trends" ? "bg-white text-primary shadow-sm" : "text-zinc-500 hover:text-zinc-700"
            )}
          >
            {t.priceTrends}
          </button>
        </div>

        {/* Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            <AnimatePresence mode="wait">
              {activeTab === "list" && (
                <motion.div 
                  key="list"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-lg font-bold text-zinc-900">
                      {role === "seller" ? `${t.nearbyMandis} ${t.districts[selectedDistrict] || selectedDistrict}` : `${t.farmersWith} ${t.crops[selectedCrop] || selectedCrop} ${t.in} ${t.districts[selectedDistrict] || selectedDistrict}`}
                    </h2>
                    <span className="text-xs text-zinc-500 font-medium">
                      {role === "seller" ? t.pricesPerQuintal : t.availableStock}
                    </span>
                  </div>
                  
                  {role === "seller" ? (
                    currentPrices.map((mandi, idx) => (
                      <div 
                        key={mandi.id}
                        className="bg-white rounded-2xl p-5 border border-zinc-200 hover:border-primary/30 transition-all group relative overflow-hidden"
                      >
                        {idx === 0 && (
                          <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl">
                            {t.bestPrice}
                          </div>
                        )}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex gap-4">
                            <div className="w-16 h-16 bg-zinc-50 rounded-2xl overflow-hidden flex-shrink-0 border border-zinc-100">
                              <img 
                                src={CROP_IMAGES[selectedCrop]} 
                                alt={selectedCrop}
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                            <div>
                              <h3 className="font-bold text-zinc-900 group-hover:text-primary transition-colors">{t.mandis[mandi.name] || mandi.name}</h3>
                              <p className="text-xs text-zinc-500 flex items-center gap-1 mt-1">
                                <Info size={12} />
                                {mandi.address}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between sm:justify-end gap-6 sm:gap-10">
                            <div className="text-right">
                              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{t.todaysPrice}</p>
                              <p className="text-2xl font-black text-zinc-900">₹{mandi.price}</p>
                            </div>
                            <button className="p-3 bg-zinc-50 text-zinc-400 hover:text-primary hover:bg-primary-light rounded-xl transition-all">
                              <Phone size={20} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="space-y-6">
                      {/* Filters UI */}
                      <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-200 flex flex-wrap gap-4 items-end">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">{t.minQuantity} (Qtl)</label>
                          <input 
                            type="number" 
                            value={quantityFilter}
                            onChange={(e) => setQuantityFilter(Number(e.target.value))}
                            className="w-24 bg-white border border-zinc-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">{t.minPrice} (₹)</label>
                          <input 
                            type="number" 
                            value={priceRange.min}
                            onChange={(e) => setPriceRange({ ...priceRange, min: Number(e.target.value) })}
                            className="w-28 bg-white border border-zinc-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">{t.maxPrice} (₹)</label>
                          <input 
                            type="number" 
                            value={priceRange.max}
                            onChange={(e) => setPriceRange({ ...priceRange, max: Number(e.target.value) })}
                            className="w-28 bg-white border border-zinc-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                          />
                        </div>
                        <button 
                          onClick={() => {
                            setQuantityFilter(0);
                            setPriceRange({ min: 0, max: 10000 });
                          }}
                          className="px-4 py-1.5 text-xs font-bold text-zinc-500 hover:text-primary transition-colors"
                        >
                          Reset
                        </button>
                      </div>

                      {filteredFarmerListings.length > 0 ? (
                        filteredFarmerListings.map((listing) => (
                        <div 
                          key={listing.id}
                          className="bg-white rounded-2xl p-5 border border-zinc-200 hover:border-primary/30 transition-all group relative overflow-hidden"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex gap-4">
                              <div className="w-16 h-16 bg-zinc-50 rounded-2xl overflow-hidden flex-shrink-0 border border-zinc-100">
                                <img 
                                  src={CROP_IMAGES[listing.crop]} 
                                  alt={listing.crop}
                                  className="w-full h-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                              <div>
                                <h3 className="font-bold text-zinc-900 group-hover:text-primary transition-colors">{listing.farmerName}</h3>
                                <p className="text-xs text-zinc-500 flex items-center gap-1 mt-1">
                                  <MapPin size={12} />
                                  {listing.location}
                                </p>
                                <p className="text-[10px] text-primary font-bold mt-1">{listing.quantity} {t.quintalsAvailable}</p>
                              </div>
                            </div>
                            <div className="flex items-center justify-between sm:justify-end gap-6 sm:gap-10">
                              <div className="text-right">
                                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{t.askingPrice}</p>
                                <p className="text-2xl font-black text-zinc-900">₹{listing.price}</p>
                              </div>
                              <button className="p-3 bg-zinc-50 text-zinc-400 hover:text-primary hover:bg-primary-light rounded-xl transition-all">
                                <Phone size={20} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-zinc-200">
                        <p className="text-zinc-400">{t.noFarmersFound} {t.crops[selectedCrop] || selectedCrop} {t.in} {t.districts[selectedDistrict] || selectedDistrict} {t.yet}.</p>
                      </div>
                    )
                  }
                </div>
              )}
            </motion.div>
          )}

            {activeTab === "map" && (
                <motion.div 
                  key="map"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white p-2 rounded-2xl border border-zinc-200 shadow-sm overflow-hidden"
                >
                  <MapContainer 
                    center={mapCenter} 
                    zoom={11} 
                    scrollWheelZoom={false}
                    className="z-0"
                  >
                    <ChangeView center={mapCenter} zoom={11} />
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    {role === "seller" ? (
                      filteredMandis.map(mandi => (
                        <Marker key={mandi.id} position={[mandi.lat, mandi.lng]}>
                          <Popup>
                            <div className="p-1">
                              <h4 className="font-bold text-primary">{t.mandis[mandi.name] || mandi.name}</h4>
                              <p className="text-xs text-zinc-600 my-1">{mandi.address}</p>
                              <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-100">
                                <span className="text-xs font-bold">₹{currentPrices.find(p => p.id === mandi.id)?.price}</span>
                                <a href={`tel:${mandi.contact}`} className="text-primary"><Phone size={14} /></a>
                              </div>
                            </div>
                          </Popup>
                        </Marker>
                      ))
                    ) : (
                      // For buyer, we could show farmer locations if we had lat/lng for them
                      // Using mandi locations as placeholders for stock availability
                      filteredMandis.map(mandi => (
                        <Marker key={mandi.id} position={[mandi.lat, mandi.lng]}>
                          <Popup>
                            <div className="p-1">
                              <h4 className="font-bold text-primary">{t.stockPoint}: {t.mandis[mandi.name] || mandi.name}</h4>
                              <p className="text-xs text-zinc-600 my-1">{t.bulkStockAvailable}</p>
                            </div>
                          </Popup>
                        </Marker>
                      ))
                    )}
                  </MapContainer>
                </motion.div>
              )}

              {activeTab === "trends" && (
                <motion.div 
                  key="trends"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm"
                >
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl overflow-hidden border border-zinc-200 flex-shrink-0">
                        <img 
                          src={CROP_IMAGES[selectedCrop]} 
                          alt={selectedCrop}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-zinc-900">
                          {role === "seller" ? `${t.priceTrend}: ${t.crops[selectedCrop] || selectedCrop}` : `${t.procurementTrend}: ${t.crops[selectedCrop] || selectedCrop}`}
                        </h2>
                        <p className="text-xs text-zinc-500">{t.last7DaysIn} {t.mandis[filteredMandis[0]?.name] || filteredMandis[0]?.name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
                      <ArrowUpRight size={16} />
                      <span className="text-xs font-bold">+2.4%</span>
                    </div>
                  </div>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={trendData}>
                        <defs>
                          <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#15803d" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="#15803d" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                        <XAxis 
                          dataKey="date" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 10, fill: '#71717a' }}
                        />
                        <YAxis 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 10, fill: '#71717a' }}
                          domain={['dataMin - 100', 'dataMax + 100']}
                        />
                        <Tooltip 
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="price" 
                          stroke="#15803d" 
                          strokeWidth={3}
                          fillOpacity={1} 
                          fill="url(#colorPrice)" 
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Active Alerts */}
            <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-zinc-900 flex items-center gap-2">
                  <Bell size={18} className="text-primary" />
                  {role === "seller" ? t.priceAlerts : t.stockAlerts}
                </h3>
                <button 
                  onClick={() => setShowAlertModal(true)}
                  className="text-[10px] font-bold text-primary hover:underline uppercase tracking-wider"
                >
                  {t.addNew}
                </button>
              </div>
              
              <div className="space-y-3">
                {alerts.length === 0 ? (
                  <div className="text-center py-6 bg-zinc-50 rounded-xl border border-dashed border-zinc-200">
                    <p className="text-xs text-zinc-400">{t.noActiveAlerts}</p>
                  </div>
                ) : (
                  alerts.map(alert => (
                    <div key={alert.id} className="flex items-center justify-between p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg overflow-hidden border border-zinc-200 flex-shrink-0">
                          <img 
                            src={CROP_IMAGES[alert.crop]} 
                            alt={alert.crop}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-zinc-900">{t.crops[alert.crop] || alert.crop}</p>
                          <p className="text-[10px] text-zinc-500">
                            {alert.condition === "below" ? t.below : t.above} ₹{alert.targetPrice}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                        <button 
                          onClick={() => setAlerts(alerts.filter(a => a.id !== alert.id))}
                          className="text-zinc-400 hover:text-red-500"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Market Insights */}
            <div className="bg-primary rounded-2xl p-6 text-white shadow-lg shadow-primary/20">
              <h3 className="font-bold mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Logo className="w-6 h-6" iconOnly variant="white" />
                  {role === "seller" ? t.marketInsight : t.sourcingInsight}
                </div>
                {isInsightLoading && <RefreshCw size={14} className="animate-spin opacity-50" />}
              </h3>
              <div className="min-h-[60px]">
                {isInsightLoading ? (
                  <p className="text-sm text-white/60 italic animate-pulse">
                    {t.loadingInsight}
                  </p>
                ) : (
                  <p className="text-sm text-white/90 leading-relaxed">
                    {insight}
                  </p>
                )}
              </div>
              <div className="mt-6 pt-6 border-t border-white/10">
                <button 
                  onClick={handleReadFullReport}
                  className="w-full bg-white/10 hover:bg-white/20 text-white text-xs font-bold py-2 rounded-lg transition-all flex items-center justify-center gap-2"
                >
                  {t.readReport}
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>

            {/* Role Specific Action */}
            <div className="bg-zinc-900 rounded-2xl p-6 text-white shadow-xl">
              <h3 className="font-bold mb-2 flex items-center gap-2">
                {role === "seller" ? (
                  <Logo className="w-6 h-6" iconOnly variant="white" />
                ) : <Search size={18} className="text-primary" />}
                {role === "seller" ? t.sellCrop : t.postRequirement}
              </h3>
              <p className="text-xs text-zinc-400 mb-4">
                {role === "seller" ? t.sellText : t.postText}
              </p>
              <button 
                onClick={() => setShowListStockModal(true)}
                className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
              >
                {role === "seller" ? t.listStock : t.postNeed}
                <ArrowUpRight size={16} />
              </button>
            </div>

            {/* Support Card */}
            <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6">
              <h3 className="font-bold text-zinc-900 mb-2">{t.needHelp}</h3>
              <p className="text-xs text-zinc-500 mb-4">
                {role === "seller" ? t.helpTextSeller : t.helpTextBuyer}
              </p>
              <a 
                href="tel:1800123456" 
                className="flex items-center justify-center gap-2 w-full py-3 bg-zinc-900 text-white rounded-xl font-bold text-sm hover:bg-zinc-800 transition-all"
              >
                <Phone size={16} />
                1800-123-456
              </a>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-zinc-200 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
            <Logo className="w-8 h-8" />
          </div>
          <div className="flex gap-8">
            <a href="#" className="text-xs font-bold text-zinc-400 hover:text-primary transition-colors">{t.privacyPolicy}</a>
            <a href="#" className="text-xs font-bold text-zinc-400 hover:text-primary transition-colors">{t.termsOfService}</a>
            <a href="#" className="text-xs font-bold text-zinc-400 hover:text-primary transition-colors">{t.contactUs}</a>
          </div>
          <p className="text-xs text-zinc-400">© 2026 MandiBridge. {t.allRightsReserved}</p>
        </div>
      </footer>

      {/* Alert Modal */}
      <AnimatePresence>
        {showAlertModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAlertModal(false)}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
                <h3 className="text-xl font-bold text-zinc-900">{t.setAlert}</h3>
                <button 
                  onClick={() => setShowAlertModal(false)}
                  className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{t.crop}</label>
                  <select 
                    value={newAlert.crop}
                    onChange={(e) => setNewAlert({ ...newAlert, crop: e.target.value })}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  >
                    {CROPS.map(c => <option key={c} value={c}>{t.crops[c] || c}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{t.condition}</label>
                    <select 
                      value={newAlert.condition}
                      onChange={(e) => setNewAlert({ ...newAlert, condition: e.target.value as any })}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    >
                      <option value="below">{t.below}</option>
                      <option value="above">{t.above}</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{t.price} (₹)</label>
                    <input 
                      type="number" 
                      value={newAlert.price}
                      onChange={(e) => setNewAlert({ ...newAlert, price: Number(e.target.value) })}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    />
                  </div>
                </div>
                <button 
                  onClick={handleAddAlert}
                  className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
                >
                  <CheckCircle2 size={20} />
                  {t.createAlert}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* List Stock Modal */}
      <AnimatePresence>
        {showListStockModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowListStockModal(false)}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
                <h3 className="text-xl font-bold text-zinc-900">{t.listStockTitle}</h3>
                <button 
                  onClick={() => setShowListStockModal(false)}
                  className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{t.farmerName}</label>
                  <input 
                    type="text" 
                    value={newListing.farmerName}
                    onChange={(e) => setNewListing({ ...newListing, farmerName: e.target.value })}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    placeholder="Enter your name"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{t.crop}</label>
                  <select 
                    value={newListing.crop}
                    onChange={(e) => setNewListing({ ...newListing, crop: e.target.value, price: BASE_PRICES[e.target.value] })}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  >
                    {CROPS.map(c => <option key={c} value={c}>{t.crops[c] || c}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{t.quantity}</label>
                    <input 
                      type="number" 
                      value={newListing.quantity}
                      onChange={(e) => setNewListing({ ...newListing, quantity: Number(e.target.value) })}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{t.askingPriceForm}</label>
                    <input 
                      type="number" 
                      value={newListing.price}
                      onChange={(e) => setNewListing({ ...newListing, price: Number(e.target.value) })}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{t.locationForm}</label>
                  <input 
                    type="text" 
                    value={newListing.location}
                    onChange={(e) => setNewListing({ ...newListing, location: e.target.value })}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    placeholder="e.g. Doddaballapura, Bangalore"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{t.contactNumber}</label>
                  <input 
                    type="text" 
                    value={newListing.contact}
                    onChange={(e) => setNewListing({ ...newListing, contact: e.target.value })}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    placeholder="+91 XXXXX XXXXX"
                  />
                </div>
                <button 
                  onClick={handleAddListing}
                  className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 mt-4"
                >
                  <CheckCircle2 size={20} />
                  {t.submitListing}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Full Report Modal */}
      <AnimatePresence>
        {showReportModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowReportModal(false)}
              className="absolute inset-0 bg-zinc-900/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-50">
                <div className="flex items-center gap-3">
                  <Logo className="w-10 h-10" iconOnly />
                  <div>
                    <h3 className="text-lg font-bold text-zinc-900">{t.marketInsight}</h3>
                    <p className="text-xs text-zinc-500">{t.crops[selectedCrop]} in {t.districts[selectedDistrict]}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowReportModal(false)}
                  className="p-2 hover:bg-zinc-200 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="p-8 overflow-y-auto flex-1">
                {isReportLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <RefreshCw size={40} className="text-primary animate-spin" />
                    <p className="text-zinc-500 font-medium">{t.loadingInsight}</p>
                  </div>
                ) : (
                  <div className="prose prose-zinc max-w-none prose-headings:text-zinc-900 prose-p:text-zinc-600 prose-li:text-zinc-600">
                    <ReactMarkdown>{fullReport}</ReactMarkdown>
                  </div>
                )}
              </div>
              
              <div className="p-6 border-t border-zinc-100 bg-zinc-50 flex justify-end">
                <button 
                  onClick={() => setShowReportModal(false)}
                  className="px-6 py-2 bg-zinc-900 text-white rounded-xl font-bold text-sm hover:bg-zinc-800 transition-all"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* List Stock Modal */}
      <AnimatePresence>
        {showListStockModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowListStockModal(false)}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
                <h3 className="text-xl font-bold text-zinc-900">{t.listStockTitle}</h3>
                <button 
                  onClick={() => setShowListStockModal(false)}
                  className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{t.farmerName}</label>
                  <input 
                    type="text" 
                    value={newListing.farmerName}
                    onChange={(e) => setNewListing({ ...newListing, farmerName: e.target.value })}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    placeholder="Enter your name"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{t.crop}</label>
                  <select 
                    value={newListing.crop}
                    onChange={(e) => setNewListing({ ...newListing, crop: e.target.value, price: BASE_PRICES[e.target.value] })}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  >
                    {CROPS.map(c => <option key={c} value={c}>{t.crops[c] || c}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{t.quantity}</label>
                    <input 
                      type="number" 
                      value={newListing.quantity}
                      onChange={(e) => setNewListing({ ...newListing, quantity: Number(e.target.value) })}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{t.askingPriceForm}</label>
                    <input 
                      type="number" 
                      value={newListing.price}
                      onChange={(e) => setNewListing({ ...newListing, price: Number(e.target.value) })}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{t.locationForm}</label>
                  <input 
                    type="text" 
                    value={newListing.location}
                    onChange={(e) => setNewListing({ ...newListing, location: e.target.value })}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    placeholder="e.g. Doddaballapura, Bangalore"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{t.contactNumber}</label>
                  <input 
                    type="text" 
                    value={newListing.contact}
                    onChange={(e) => setNewListing({ ...newListing, contact: e.target.value })}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    placeholder="+91 XXXXX XXXXX"
                  />
                </div>
                <button 
                  onClick={handleAddListing}
                  className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 mt-4"
                >
                  <CheckCircle2 size={20} />
                  {t.submitListing}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Full Report Modal */}
      <AnimatePresence>
        {showReportModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowReportModal(false)}
              className="absolute inset-0 bg-zinc-900/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-50">
                <div className="flex items-center gap-3">
                  <Logo className="w-10 h-10" iconOnly />
                  <div>
                    <h3 className="text-lg font-bold text-zinc-900">{t.marketInsight}</h3>
                    <p className="text-xs text-zinc-500">{t.crops[selectedCrop]} in {t.districts[selectedDistrict]}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowReportModal(false)}
                  className="p-2 hover:bg-zinc-200 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="p-8 overflow-y-auto flex-1">
                {isReportLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <RefreshCw size={40} className="text-primary animate-spin" />
                    <p className="text-zinc-500 font-medium">{t.loadingInsight}</p>
                  </div>
                ) : (
                  <div className="prose prose-zinc max-w-none prose-headings:text-zinc-900 prose-p:text-zinc-600 prose-li:text-zinc-600">
                    <ReactMarkdown>{fullReport}</ReactMarkdown>
                  </div>
                )}
              </div>
              
              <div className="p-6 border-t border-zinc-100 bg-zinc-50 flex justify-end">
                <button 
                  onClick={() => setShowReportModal(false)}
                  className="px-6 py-2 bg-zinc-900 text-white rounded-xl font-bold text-sm hover:bg-zinc-800 transition-all"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
