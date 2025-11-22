import { CrmBooking } from '../types';

// In-memory database, which will be initialized on first use
let bookings: CrmBooking[] | null = null;

// Simple subscriber pattern to allow UI to react to changes
type Subscriber = (updatedBookings: CrmBooking[]) => void;
const subscribers: Set<Subscriber> = new Set();

const initializeData = () => {
    // Only initialize once
    if (bookings !== null) return;
    
    const MOCK_CRM_DATA: CrmBooking[] = [
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
        {
          "pnr": "TK100003",
          "passenger_name": "Mehmet Acar",
          "email": "mehmet.acar@example.com",
          "phone_number": "+905553456789",
          "flight_number": "TK1670",
          "origin": "SAW - Sabiha Gökçen Airport",
          "destination": "AMS - Amsterdam Schiphol",
          "flight_date": "2025-11-07T06:15:00Z",
          "status": "confirmed",
          "notes": []
        },
        {
          "pnr": "TK100004",
          "passenger_name": "Leyla Öztürk",
          "email": "leyla.ozturk@example.com",
          "phone_number": "+905554567890",
          "flight_number": "TK2310",
          "origin": "IST - Istanbul Airport",
          "destination": "FRA - Frankfurt International",
          "flight_date": "2025-11-08T09:00:00Z",
          "status": "confirmed",
          "notes": []
        },
        {
          "pnr": "TK100005",
          "passenger_name": "Can Polat",
          "email": "can.polat@example.com",
          "phone_number": "+905555678901",
          "flight_number": "TK987",
          "origin": "IST - Istanbul Airport",
          "destination": "DXB - Dubai International",
          "flight_date": "2025-11-08T23:15:00Z",
          "status": "confirmed",
          "notes": []
        },
        {
          "pnr": "TK100006",
          "passenger_name": "Selin Duru",
          "email": "selin.duru@example.com",
          "phone_number": "+905556789012",
          "flight_number": "TK1405",
          "origin": "IST - Istanbul Airport",
          "destination": "ATH - Athens International",
          "flight_date": "2025-11-09T13:45:00Z",
          "status": "canceled",
          "notes": []
        },
        {
          "pnr": "TK100007",
          "passenger_name": "Omar Said",
          "email": "omar.said@example.com",
          "phone_number": "+201001234567",
          "flight_number": "TK3340",
          "origin": "IST - Istanbul Airport",
          "destination": "CAI - Cairo International",
          "flight_date": "2025-11-10T04:45:00Z",
          "status": "confirmed",
          "notes": []
        },
        {
          "pnr": "TK100008",
          "passenger_name": "Ayşe Karaca",
          "email": "ayse.karaca@example.com",
          "phone_number": "+905557890123",
          "flight_number": "TK980",
          "origin": "IST - Istanbul Airport",
          "destination": "JFK - New York",
          "flight_date": "2025-11-10T11:30:00Z",
          "status": "confirmed",
          "notes": []
        },
        {
          "pnr": "TK100009",
          "passenger_name": "Hüseyin Demir",
          "email": "huseyin.demir@example.com",
          "phone_number": "+905558901234",
          "flight_number": "TK1975",
          "origin": "IST - Istanbul Airport",
          "destination": "BCN - Barcelona El Prat",
          "flight_date": "2025-11-11T10:00:00Z",
          "status": "confirmed",
          "notes": []
        },
        {
          "pnr": "TK100010",
          "passenger_name": "Zeynep Can",
          "email": "zeynep.can@example.com",
          "phone_number": "+905559012345",
          "flight_number": "TK2104",
          "origin": "IST - Istanbul Airport",
          "destination": "MAD - Madrid Barajas",
          "flight_date": "2025-11-11T16:30:00Z",
          "status": "confirmed",
          "notes": []
        },
        {
          "pnr": "TK100011",
          "passenger_name": "Ali Rıza",
          "email": "ali.riza@example.com",
          "phone_number": "+905550123456",
          "flight_number": "TK782",
          "origin": "IST - Istanbul Airport",
          "destination": "SIN - Singapore Changi",
          "flight_date": "2025-11-12T21:10:00Z",
          "status": "confirmed",
          "notes": []
        },
        {
          "pnr": "TK100012",
          "passenger_name": "Fatma Güler",
          "email": "fatma.guler@example.com",
          "phone_number": "+905551234567",
          "flight_number": "TK703",
          "origin": "IST - Istanbul Airport",
          "destination": "HKG - Hong Kong International",
          "flight_date": "2025-11-13T22:20:00Z",
          "status": "confirmed",
          "notes": []
        },
        {
          "pnr": "TK100013",
          "passenger_name": "Murat Kaya",
          "email": "murat.kaya@example.com",
          "phone_number": "+905552345678",
          "flight_number": "TK1123",
          "origin": "IST - Istanbul Airport",
          "destination": "VIE - Vienna International",
          "flight_date": "2025-11-14T09:00:00Z",
          "status": "confirmed",
          "notes": []
        },
        {
          "pnr": "TK100014",
          "passenger_name": "Burcu Aksoy",
          "email": "burcu.aksoy@example.com",
          "phone_number": "+905553456789",
          "flight_number": "TK1490",
          "origin": "IST - Istanbul Airport",
          "destination": "MUC - Munich Airport",
          "flight_date": "2025-11-15T12:10:00Z",
          "status": "confirmed",
          "notes": []
        },
        {
          "pnr": "TK100015",
          "passenger_name": "Deniz Altan",
          "email": "deniz.altan@example.com",
          "phone_number": "+905554567890",
          "flight_number": "TK745",
          "origin": "IST - Istanbul Airport",
          "destination": "KUL - Kuala Lumpur",
          "flight_date": "2025-11-15T23:45:00Z",
          "status": "confirmed",
          "notes": []
        },
        {
          "pnr": "TK100016",
          "passenger_name": "Emre Usta",
          "email": "emre.usta@example.com",
          "phone_number": "+905555678901",
          "flight_number": "TK1720",
          "origin": "IST - Istanbul Airport",
          "destination": "ZRH - Zurich Airport",
          "flight_date": "2025-11-16T06:20:00Z",
          "status": "confirmed",
          "notes": []
        },
        {
          "pnr": "TK100017",
          "passenger_name": "Seda Eren",
          "email": "seda.eren@example.com",
          "phone_number": "+905556789012",
          "flight_number": "TK2051",
          "origin": "IST - Istanbul Airport",
          "destination": "DUS - Düsseldorf Airport",
          "flight_date": "2025-11-17T10:30:00Z",
          "status": "canceled",
          "notes": []
        },
        {
          "pnr": "TK100018",
          "passenger_name": "Yusuf Tan",
          "email": "yusuf.tan@example.com",
          "phone_number": "+905557890123",
          "flight_number": "TK702",
          "origin": "IST - Istanbul Airport",
          "destination": "BKK - Bangkok Suvarnabhumi",
          "flight_date": "2025-11-18T20:00:00Z",
          "status": "confirmed",
          "notes": []
        },
        {
          "pnr": "TK100019",
          "passenger_name": "Nadia Faruk",
          "email": "nadia.faruk@example.com",
          "phone_number": "+966501234567",
          "flight_number": "TK9872",
          "origin": "IST - Istanbul Airport",
          "destination": "JED - Jeddah",
          "flight_date": "2025-11-19T03:15:00Z",
          "status": "confirmed",
          "notes": []
        },
        {
          "pnr": "TK100020",
          "passenger_name": "Kemal Yildirim",
          "email": "kemal.yildirim@example.com",
          "phone_number": "+905558901234",
          "flight_number": "TK2023",
          "origin": "IST - Istanbul Airport",
          "destination": "ORD - Chicago O’Hare",
          "flight_date": "2025-11-20T14:00:00Z",
          "status": "confirmed",
          "notes": []
        }
    ];
    bookings = JSON.parse(JSON.stringify(MOCK_CRM_DATA));
}

const notify = () => {
    if (bookings === null) return;
    // Notify subscribers with a new array copy to ensure React re-renders
    subscribers.forEach(callback => callback([...bookings!]));
};

export const crmService = {
  subscribe: (callback: Subscriber): (() => void) => {
    initializeData();
    subscribers.add(callback);
    // Return an unsubscribe function
    return () => subscribers.delete(callback);
  },
  
  getBookings: (): CrmBooking[] => {
    initializeData();
    // Return a copy to prevent direct mutation
    return [...bookings!];
  },

  getBookingByPnr: (pnr: string): CrmBooking | undefined => {
    initializeData();
    const booking = bookings!.find(b => b.pnr === pnr);
    // Return a copy
    return booking ? { ...booking } : undefined;
  },

  addBooking: (booking: CrmBooking): CrmBooking => {
    initializeData();
    if (bookings!.some(b => b.pnr === booking.pnr)) {
      throw new Error('A booking with this PNR already exists.');
    }
    const newBooking: CrmBooking = {
      ...booking,
      notes: booking.notes || [], // Ensure notes array exists
    };
    bookings!.push(newBooking);
    notify();
    return { ...newBooking };
  },

  updateBooking: (pnr: string, updates: Partial<CrmBooking>): CrmBooking => {
    initializeData();
    const index = bookings!.findIndex(b => b.pnr === pnr);
    if (index === -1) {
      throw new Error('Booking not found to update.');
    }
    // Ensure PNR is not changed
    const { pnr: _, ...safeUpdates } = updates;
    const updatedBooking = { ...bookings![index], ...safeUpdates };
    bookings![index] = updatedBooking;
    notify();
    return { ...updatedBooking };
  },

  deleteBooking: (pnr: string): void => {
    initializeData();
    const initialLength = bookings!.length;
    bookings = bookings!.filter(b => b.pnr !== pnr);
    if (bookings!.length === initialLength) {
        // Optionally throw an error if the item to delete was not found
        // For a robust UI, we can also just proceed silently
        console.warn(`Booking with PNR ${pnr} not found for deletion.`);
    }
    notify();
  },

  addNoteToBooking: (pnr: string, note: { text: string; by: string; date: string; }): CrmBooking => {
      initializeData();
      const index = bookings!.findIndex(b => b.pnr === pnr);
      if (index === -1) {
        throw new Error('Booking not found to add note.');
      }
      const booking = bookings![index];
      if (!booking.notes) {
          booking.notes = [];
      }
      booking.notes.push(note);
      notify();
      return { ...booking };
  }
};