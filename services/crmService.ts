
import { CrmBooking } from '../types';
import * as dataService from './dataService';

// In-memory database
let bookings: CrmBooking[] | null = null;

// Simple subscriber pattern to allow UI to react to changes
type Subscriber = (updatedBookings: CrmBooking[]) => void;
const subscribers: Set<Subscriber> = new Set();

// Load initial data from dataService (which checks Supabase/IDB)
const initializeData = async () => {
    if (bookings !== null) return; // Already initialized

    try {
        const fetchedBookings = await dataService.getCrmBookings();
        if (fetchedBookings.length > 0) {
            bookings = fetchedBookings;
        } else {
             // Fallback MOCK data if DB is empty
            bookings = getMockData();
            // Optionally sync mock data to DB for first run
            // fetchedBookings.forEach(b => dataService.createCrmBooking(b));
        }
    } catch (e) {
        console.warn("Failed to initialize CRM data from service, using mock.", e);
        bookings = getMockData();
    }
    notify();
};

const getMockData = (): CrmBooking[] => [
        {
          "pnr": "TK100001",
          "passenger_name": "Ahmet Kaya",
          "email": "ahmet.kaya@example.com",
          "phone_number": "+905551234567",
          "flight_number": "TK1941",
          "origin": "IST - Istanbul Airport",
          "destination": "CDG - Paris Charles de Gaulle",
          "flight_date": "2025-11-05T07:00:00Z",
          "status": "confirmed",
          "notes": []
        },
        {
          "pnr": "TK100002",
          "passenger_name": "Elif Yilmaz",
          "email": "elif.yilmaz@example.com",
          "phone_number": "+905552345678",
          "flight_number": "TK1955",
          "origin": "IST - Istanbul Airport",
          "destination": "LHR - London Heathrow",
          "flight_date": "2025-11-06T08:30:00Z",
          "status": "confirmed",
          "notes": []
        },
        // ... (Other mock data can be re-added here if needed for fallback)
];

const notify = () => {
    if (bookings === null) return;
    subscribers.forEach(callback => callback([...bookings!]));
};

export const crmService = {
  subscribe: (callback: Subscriber): (() => void) => {
    if (bookings === null) {
        initializeData();
    } else {
        callback([...bookings]);
    }
    subscribers.add(callback);
    return () => subscribers.delete(callback);
  },
  
  getBookings: (): CrmBooking[] => {
    if (bookings === null) {
         // Return empty initially, triggers async init
         initializeData();
         return [];
    }
    return [...bookings];
  },

  getBookingByPnr: (pnr: string): CrmBooking | undefined => {
    if (bookings === null) return undefined;
    const booking = bookings.find(b => b.pnr === pnr);
    return booking ? { ...booking } : undefined;
  },

  addBooking: (booking: CrmBooking): CrmBooking => {
    if (bookings === null) bookings = [];
    if (bookings.some(b => b.pnr === booking.pnr)) {
      throw new Error('A booking with this PNR already exists.');
    }
    const newBooking: CrmBooking = {
      ...booking,
      notes: booking.notes || [], 
    };
    bookings.push(newBooking);
    notify();
    return { ...newBooking };
  },

  updateBooking: (pnr: string, updates: Partial<CrmBooking>): CrmBooking => {
    if (bookings === null) throw new Error("CRM not initialized");
    const index = bookings.findIndex(b => b.pnr === pnr);
    if (index === -1) {
      throw new Error('Booking not found to update.');
    }
    const { pnr: _, ...safeUpdates } = updates;
    const updatedBooking = { ...bookings[index], ...safeUpdates };
    bookings[index] = updatedBooking;
    notify();
    return { ...updatedBooking };
  },

  deleteBooking: (pnr: string): void => {
    if (bookings === null) return;
    const initialLength = bookings.length;
    bookings = bookings.filter(b => b.pnr !== pnr);
    if (bookings.length === initialLength) {
        console.warn(`Booking with PNR ${pnr} not found for deletion.`);
    }
    notify();
  },

  addNoteToBooking: (pnr: string, note: { text: string; by: string; date: string; }): CrmBooking => {
      if (bookings === null) throw new Error("CRM not initialized");
      const index = bookings.findIndex(b => b.pnr === pnr);
      if (index === -1) {
        throw new Error('Booking not found to add note.');
      }
      const booking = bookings[index];
      if (!booking.notes) {
          booking.notes = [];
      }
      booking.notes.push(note);
      notify();
      // Note: For full persistence of notes, updateCrmBooking should be called by the consumer (dataService)
      // But since dataService wraps this, we rely on dataService.updateCrmBooking being called with the new notes.
      return { ...booking };
  }
};
