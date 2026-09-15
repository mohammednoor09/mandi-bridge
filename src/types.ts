export interface Mandi {
  id: string;
  name: string;
  district: string;
  state: string;
  lat: number;
  lng: number;
  address: string;
  contact: string;
}

export interface PriceRecord {
  mandiId: string;
  crop: string;
  price: number; // per quintal
  date: string;
}

export interface PriceAlert {
  id: string;
  crop: string;
  targetPrice: number;
  condition: "above" | "below";
  active: boolean;
}

export interface FarmerListing {
  id: string;
  farmerName: string;
  crop: string;
  quantity: number; // in quintals
  price: number;
  location: string;
  contact: string;
  date: string;
}
