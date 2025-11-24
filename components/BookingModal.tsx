
import React, { useState, useEffect } from 'react';
import { CrmBooking } from '../types';
import { SaveIcon, XIcon } from './icons';

interface BookingModalProps {
  booking?: CrmBooking | null; // Pass booking for editing, null/undefined for creating
  onClose: () => void;
  onSave: (booking: CrmBooking) => Promise<void>;
  existingPnrs: string[];
}

const BookingModal: React.FC<BookingModalProps> = ({ booking, onClose, onSave, existingPnrs }) => {
  const isEditing = !!booking;
  const [formData, setFormData] = useState<Omit<CrmBooking, 'notes'>>({
    pnr: '',
    passenger_name: '',
    email: '',
    phone_number: '',
    flight_number: '',
    origin: '',
    destination: '',
    flight_date: new Date().toISOString().substring(0, 16),
    status: 'confirmed',
    ...booking
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (booking) {
      // Format date for the datetime-local input, which needs 'YYYY-MM-DDTHH:mm'
      const date = new Date(booking.flight_date);
      // Adjust for timezone offset to display local time correctly in the input
      const timezoneOffset = date.getTimezoneOffset() * 60000;
      const localDate = new Date(date.getTime() - timezoneOffset);
      const formattedDate = localDate.toISOString().substring(0, 16);
      setFormData({ ...booking, flight_date: formattedDate });
    }
  }, [booking]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSaving(true);

    // --- Validation ---
    if (!formData.pnr || !formData.passenger_name || !formData.flight_number || !formData.flight_date) {
      setError('PNR, Name, Flight Number, and Date are required.');
      setIsSaving(false);
      return;
    }

    if (!isEditing && existingPnrs.includes(formData.pnr)) {
      setError('This PNR already exists. Please use a unique PNR.');
      setIsSaving(false);
      return;
    }

    // Convert local datetime-local string back to a full ISO string (UTC)
    const bookingToSave: CrmBooking = {
        ...formData,
        flight_date: new Date(formData.flight_date).toISOString(),
        notes: booking?.notes || []
    };
    
    try {
        await onSave(bookingToSave);
    } catch (err) {
        setError((err as Error).message);
    } finally {
        setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-eburon-panel border border-eburon-border rounded-xl w-full max-w-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
        <form onSubmit={handleSubmit}>
          <header className="p-4 border-b border-eburon-border flex justify-between items-center">
            <h2 className="text-xl font-bold text-eburon-fg">{isEditing ? 'Edit Booking' : 'Create New Booking'}</h2>
            <button 
                type="button" 
                onClick={onClose} 
                className="p-1 rounded-full hover:bg-eburon-bg"
                data-tooltip="Close Modal"
            >
              <XIcon className="w-6 h-6 text-eburon-fg/70" />
            </button>
          </header>

          <main className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto">
            {/* Form Fields */}
            <div>
              <label htmlFor="pnr" className="block text-sm font-medium text-eburon-fg/80 mb-1">PNR</label>
              <input type="text" name="pnr" value={formData.pnr} onChange={handleChange} required disabled={isEditing} className="w-full bg-eburon-bg border border-eburon-border rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-eburon-accent disabled:opacity-50" />
            </div>
            <div>
              <label htmlFor="passenger_name" className="block text-sm font-medium text-eburon-fg/80 mb-1">Passenger Name</label>
              <input type="text" name="passenger_name" value={formData.passenger_name} onChange={handleChange} required className="w-full bg-eburon-bg border border-eburon-border rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-eburon-accent" />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-eburon-fg/80 mb-1">Email</label>
              <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full bg-eburon-bg border border-eburon-border rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-eburon-accent" />
            </div>
            <div>
              <label htmlFor="phone_number" className="block text-sm font-medium text-eburon-fg/80 mb-1">Phone Number</label>
              <input type="tel" name="phone_number" value={formData.phone_number} onChange={handleChange} className="w-full bg-eburon-bg border border-eburon-border rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-eburon-accent" />
            </div>
            <div>
              <label htmlFor="flight_number" className="block text-sm font-medium text-eburon-fg/80 mb-1">Flight Number</label>
              <input type="text" name="flight_number" value={formData.flight_number} onChange={handleChange} required className="w-full bg-eburon-bg border border-eburon-border rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-eburon-accent" />
            </div>
            <div>
              <label htmlFor="flight_date" className="block text-sm font-medium text-eburon-fg/80 mb-1">Flight Date</label>
              <input type="datetime-local" name="flight_date" value={formData.flight_date} onChange={handleChange} required className="w-full bg-eburon-bg border border-eburon-border rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-eburon-accent" />
            </div>
            <div>
              <label htmlFor="origin" className="block text-sm font-medium text-eburon-fg/80 mb-1">Origin</label>
              <input type="text" name="origin" value={formData.origin} onChange={handleChange} className="w-full bg-eburon-bg border border-eburon-border rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-eburon-accent" />
            </div>
            <div>
              <label htmlFor="destination" className="block text-sm font-medium text-eburon-fg/80 mb-1">Destination</label>
              <input type="text" name="destination" value={formData.destination} onChange={handleChange} className="w-full bg-eburon-bg border border-eburon-border rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-eburon-accent" />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="status" className="block text-sm font-medium text-eburon-fg/80 mb-1">Status</label>
              <select name="status" value={formData.status} onChange={handleChange} className="w-full bg-eburon-bg border border-eburon-border rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-eburon-accent">
                <option value="confirmed">Confirmed</option>
                <option value="checked_in">Checked In</option>
                <option value="completed">Completed</option>
                <option value="canceled">Canceled</option>
                <option value="pending">Pending</option>
              </select>
            </div>
          </main>

          <footer className="p-4 border-t border-eburon-border flex justify-between items-center">
            <div className="flex-grow">
                {error && <p className="text-red-400 text-sm">{error}</p>}
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button type="button" onClick={onClose} className="font-bold py-2 px-4 rounded-lg bg-eburon-border hover:bg-white/10 text-white">Cancel</button>
              <button type="submit" disabled={isSaving} className="font-bold py-2 px-4 rounded-lg flex items-center gap-2 bg-eburon-accent hover:bg-eburon-accent-dark text-white disabled:bg-gray-500">
                {isSaving ? (
                    <div className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin"></div>
                ) : (
                    <SaveIcon className="w-5 h-5" />
                )}
                <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
              </button>
            </div>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default BookingModal;
