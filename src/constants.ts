import { Mandi, PriceRecord, FarmerListing } from "./types";

export const CROPS = [
  "Wheat", "Rice", "Maize", "Cotton", "Soybean", "Onion", "Potato", "Tomato", "Mustard"
];

export const CROP_IMAGES: Record<string, string> = {
  "Wheat": "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&q=80&w=400",
  "Rice": "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&q=80&w=400",
  "Maize": "https://images.unsplash.com/photo-1551754655-cd27e38d2076?auto=format&fit=crop&q=80&w=400",
  "Cotton": "https://images.unsplash.com/photo-1594904351111-a072f80b1a71?auto=format&fit=crop&q=80&w=400",
  "Soybean": "https://images.unsplash.com/photo-1589923188900-85dae523342b?auto=format&fit=crop&q=80&w=400",
  "Onion": "https://images.unsplash.com/photo-1508747703725-719777637510?auto=format&fit=crop&q=80&w=400",
  "Potato": "https://images.unsplash.com/photo-1590165482129-1b8b27698780?auto=format&fit=crop&q=80&w=400",
  "Tomato": "https://images.unsplash.com/photo-1518977822534-7049a61ee0c2?auto=format&fit=crop&q=80&w=400",
  "Mustard": "https://images.unsplash.com/photo-1598512752271-33f913a5af13?auto=format&fit=crop&q=80&w=400"
};

export const DISTRICTS = [
  "Bangalore", "Mysore", "Belgaum", "Gulbarga", "Hubli-Dharwad", "Mangalore", "Shimoga", "Tumkur"
];

export const BASE_PRICES: Record<string, number> = {
  "Wheat": 2400,
  "Rice": 2100,
  "Maize": 2000,
  "Cotton": 7200,
  "Soybean": 5100,
  "Onion": 1800,
  "Potato": 1500,
  "Tomato": 1200,
  "Mustard": 5600
};

export const MOCK_FARMER_LISTINGS: FarmerListing[] = [
  {
    id: "f1",
    farmerName: "Ramesh Kumar",
    crop: "Wheat",
    quantity: 50,
    price: 2400,
    location: "Doddaballapura, Bangalore",
    contact: "+91 98450 12345",
    date: "2026-03-11"
  },
  {
    id: "f2",
    farmerName: "Suresh Gowda",
    crop: "Onion",
    quantity: 120,
    price: 1700,
    location: "Chikkaballapura, Bangalore",
    contact: "+91 98451 23456",
    date: "2026-03-11"
  },
  {
    id: "f3",
    farmerName: "Malleshappa",
    crop: "Tomato",
    quantity: 30,
    price: 1200,
    location: "Hoskote, Bangalore",
    contact: "+91 98452 34567",
    date: "2026-03-11"
  },
  {
    id: "f4",
    farmerName: "Basavaraj",
    crop: "Cotton",
    quantity: 200,
    price: 7100,
    location: "Bailhongal, Belgaum",
    contact: "+91 98453 45678",
    date: "2026-03-11"
  },
  {
    id: "f5",
    farmerName: "Sharanappa",
    crop: "Maize",
    quantity: 150,
    price: 1950,
    location: "Afzalpur, Gulbarga",
    contact: "+91 98454 56789",
    date: "2026-03-11"
  },
  {
    id: "f6",
    farmerName: "Ningappa",
    crop: "Soybean",
    quantity: 80,
    price: 5050,
    location: "Navalgund, Hubli-Dharwad",
    contact: "+91 98455 67890",
    date: "2026-03-11"
  }
];

export const MOCK_MANDIS: Mandi[] = [
  {
    id: "m1",
    name: "Yeshwanthpur Mandi",
    district: "Bangalore",
    state: "Karnataka",
    lat: 13.0235,
    lng: 77.5562,
    address: "APMC Yard, Yeshwanthpur, Bangalore - 560022",
    contact: "+91 80 2337 1234"
  },
  {
    id: "m2",
    name: "K.R. Puram Mandi",
    district: "Bangalore",
    state: "Karnataka",
    lat: 13.0117,
    lng: 77.7068,
    address: "Old Madras Road, K.R. Puram, Bangalore - 560036",
    contact: "+91 80 2561 5678"
  },
  {
    id: "m3",
    name: "Binny Mill Mandi",
    district: "Bangalore",
    state: "Karnataka",
    lat: 12.9642,
    lng: 77.5583,
    address: "Cottonpet, Bangalore - 560053",
    contact: "+91 80 2670 9012"
  },
  {
    id: "m10",
    name: "Dasarahalli Mandi",
    district: "Bangalore",
    state: "Karnataka",
    lat: 13.0425,
    lng: 77.5133,
    address: "T. Dasarahalli, Bangalore - 560057",
    contact: "+91 80 2839 4455"
  },
  {
    id: "m4",
    name: "Mysore APMC",
    district: "Mysore",
    state: "Karnataka",
    lat: 12.3089,
    lng: 76.6413,
    address: "Bandipalya, Mysore - 570025",
    contact: "+91 821 248 1122"
  },
  {
    id: "m11",
    name: "Nanjangud APMC",
    district: "Mysore",
    state: "Karnataka",
    lat: 12.1192,
    lng: 76.6783,
    address: "APMC Yard, Nanjangud - 571301",
    contact: "+91 8221 226 334"
  },
  {
    id: "m5",
    name: "Belgaum APMC",
    district: "Belgaum",
    state: "Karnataka",
    lat: 15.8497,
    lng: 74.4977,
    address: "APMC Yard, Belgaum - 590001",
    contact: "+91 831 242 3344"
  },
  {
    id: "m12",
    name: "Gokak APMC",
    district: "Belgaum",
    state: "Karnataka",
    lat: 16.1667,
    lng: 74.8333,
    address: "APMC Yard, Gokak - 591307",
    contact: "+91 8332 225 112"
  },
  {
    id: "m6",
    name: "Gulbarga Mandi",
    district: "Gulbarga",
    state: "Karnataka",
    lat: 17.3297,
    lng: 76.8343,
    address: "Nehru Gunj, Gulbarga - 585104",
    contact: "+91 8472 221 556"
  },
  {
    id: "m13",
    name: "Sedam Mandi",
    district: "Gulbarga",
    state: "Karnataka",
    lat: 17.1833,
    lng: 77.2833,
    address: "APMC Yard, Sedam - 585222",
    contact: "+91 8441 276 110"
  },
  {
    id: "m7",
    name: "Hubli APMC",
    district: "Hubli-Dharwad",
    state: "Karnataka",
    lat: 15.3647,
    lng: 75.1240,
    address: "Amargol, Hubli - 580025",
    contact: "+91 836 222 7788"
  },
  {
    id: "m14",
    name: "Dharwad APMC",
    district: "Hubli-Dharwad",
    state: "Karnataka",
    lat: 15.4589,
    lng: 75.0078,
    address: "APMC Yard, Dharwad - 580001",
    contact: "+91 836 244 5566"
  },
  {
    id: "m8",
    name: "Mangalore APMC",
    district: "Mangalore",
    state: "Karnataka",
    lat: 12.8706,
    lng: 74.8807,
    address: "Baikampady, Mangalore - 575011",
    contact: "+91 824 240 9900"
  },
  {
    id: "m15",
    name: "Bantwal APMC",
    district: "Mangalore",
    state: "Karnataka",
    lat: 12.8897,
    lng: 75.0342,
    address: "B.C. Road, Bantwal - 574211",
    contact: "+91 8255 233 112"
  },
  {
    id: "m9",
    name: "Shimoga Mandi",
    district: "Shimoga",
    state: "Karnataka",
    lat: 13.9299,
    lng: 75.5681,
    address: "Sagar Road, Shimoga - 577201",
    contact: "+91 8182 222 111"
  },
  {
    id: "m16",
    name: "Sagar APMC",
    district: "Shimoga",
    state: "Karnataka",
    lat: 14.1667,
    lng: 75.0333,
    address: "APMC Yard, Sagar - 577401",
    contact: "+91 8183 226 445"
  },
  {
    id: "m17",
    name: "Tumkur APMC",
    district: "Tumkur",
    state: "Karnataka",
    lat: 13.3392,
    lng: 77.1140,
    address: "Batawadi, Tumkur - 572103",
    contact: "+91 816 227 8899"
  },
  {
    id: "m18",
    name: "Tiptur APMC",
    district: "Tumkur",
    state: "Karnataka",
    lat: 13.2638,
    lng: 76.4783,
    address: "APMC Yard, Tiptur - 572201",
    contact: "+91 8134 251 223"
  },
  {
    id: "m19",
    name: "Kunigal APMC",
    district: "Tumkur",
    state: "Karnataka",
    lat: 13.0233,
    lng: 77.0333,
    address: "APMC Yard, Kunigal - 572130",
    contact: "+91 8132 220 445"
  }
];

export const MOCK_PRICES: PriceRecord[] = [
  // Bangalore - Wheat
  { mandiId: "m1", crop: "Wheat", price: 2450, date: "2026-03-11" },
  { mandiId: "m2", crop: "Wheat", price: 2520, date: "2026-03-11" },
  { mandiId: "m3", crop: "Wheat", price: 2480, date: "2026-03-11" },
  // Bangalore - Onion
  { mandiId: "m1", crop: "Onion", price: 1800, date: "2026-03-11" },
  { mandiId: "m2", crop: "Onion", price: 1750, date: "2026-03-11" },
  { mandiId: "m3", crop: "Onion", price: 1900, date: "2026-03-11" },
  // Historical for m1 Wheat
  { mandiId: "m1", crop: "Wheat", price: 2400, date: "2026-03-10" },
  { mandiId: "m1", crop: "Wheat", price: 2380, date: "2026-03-09" },
  { mandiId: "m1", crop: "Wheat", price: 2420, date: "2026-03-08" },
  { mandiId: "m1", crop: "Wheat", price: 2450, date: "2026-03-07" },
  { mandiId: "m1", crop: "Wheat", price: 2430, date: "2026-03-06" },
];
