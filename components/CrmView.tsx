
import React, { useState, useMemo, useEffect } from 'react';
import { CrmBooking } from '../types';
import CrmDetailView from './CrmDetailView';
import { SearchIcon, DatabaseIcon, PlusIcon, EditIcon, Trash2Icon } from './icons';
import { crmService } from '../services/crmService';
import * as dataService from '../services/dataService';
import { LoadingIndicator } from './LoadingIndicator';
import BookingModal from './BookingModal';

const CrmView: React.FC = () => {
    const [bookings, setBookings] = useState<CrmBooking[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedBooking, setSelectedBooking] = useState<CrmBooking | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    // State for modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingBooking, setEditingBooking] = useState<CrmBooking | null>(null);
    
    useEffect(() => {
        // Initial load
        const initialBookings = crmService.getBookings();
        setBookings(initialBookings);
        setIsLoading(false);

        // Subscribe to future updates from Ayla or other components
        const unsubscribe = crmService.subscribe(updatedBookings => {
            setBookings(updatedBookings);
        });

        return () => unsubscribe(); // Cleanup subscription on unmount
    }, []);

    const filteredBookings = useMemo(() => {
        if (!searchTerm) return bookings;
        const lowercasedFilter = searchTerm.toLowerCase();
        return bookings.filter(b =>
            b.pnr.toLowerCase().includes(lowercasedFilter) ||
            b.passenger_name.toLowerCase().includes(lowercasedFilter) ||
            b.flight_number.toLowerCase().includes(lowercasedFilter)
        );
    }, [bookings, searchTerm]);

    const handleOpenCreateModal = () => {
        setEditingBooking(null);
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (booking: CrmBooking) => {
        setEditingBooking(booking);
        setIsModalOpen(true);
    };

    const handleDeleteBooking = async (pnr: string) => {
        if (window.confirm(`Are you sure you want to delete booking ${pnr}? This action cannot be undone.`)) {
            try {
                await dataService.deleteCrmBooking(pnr);
                // The view will update automatically via the subscription
            } catch (error) {
                alert(`Error: ${(error as Error).message}`);
            }
        }
    };

    const handleSaveBooking = async (booking: CrmBooking) => {
        try {
            if (editingBooking) {
                await dataService.updateCrmBooking(booking.pnr, booking);
            } else {
                await dataService.createCrmBooking(booking);
            }
            setIsModalOpen(false);
            setEditingBooking(null);
        } catch (error) {
            // The modal will display its own error, but we can alert as a fallback.
            console.error("Save failed:", error);
        }
    };

    if (isLoading) {
        return <LoadingIndicator text="Loading CRM..." />;
    }

    if (selectedBooking) {
        return <CrmDetailView booking={selectedBooking} onBack={() => setSelectedBooking(null)} />;
    }

    return (
        <div className="p-8 h-full flex flex-col">
            {isModalOpen && (
                <BookingModal
                    booking={editingBooking}
                    onClose={() => setIsModalOpen(false)}
                    onSave={handleSaveBooking}
                    existingPnrs={bookings.map(b => b.pnr)}
                />
            )}
            <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-eburon-fg">Customer Relationship Management</h1>
                    <p className="text-eburon-fg/70">View, create, and manage passenger bookings in real-time.</p>
                </div>
                 <button onClick={handleOpenCreateModal} className="flex items-center gap-2 bg-eburon-accent hover:bg-eburon-accent-dark text-white font-bold py-2 px-4 rounded-lg transition-colors">
                    <PlusIcon className="w-5 h-5" />
                    <span>New Booking</span>
                </button>
            </div>


            <div className="relative mb-4">
                <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-eburon-fg/50" />
                <input
                    type="text"
                    placeholder="Search by PNR, name, or flight..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full bg-eburon-panel border border-eburon-border rounded-lg pl-11 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-eburon-accent"
                />
            </div>

            <div className="flex-grow overflow-auto bg-eburon-panel border border-eburon-border rounded-xl">
                <table className="w-full min-w-[800px] text-sm text-left text-eburon-fg/80">
                    <thead className="text-xs text-eburon-fg/60 uppercase sticky top-0 bg-eburon-panel z-10">
                        <tr>
                            <th scope="col" className="px-6 py-3">PNR</th>
                            <th scope="col" className="px-6 py-3">Passenger</th>
                            <th scope="col" className="px-6 py-3">Flight</th>
                            <th scope="col" className="px-6 py-3">Date</th>
                            <th scope="col" className="px-6 py-3">Status</th>
                            <th scope="col" className="px-6 py-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredBookings.length > 0 ? filteredBookings.map(booking => (
                            <tr
                                key={booking.pnr}
                                className="border-t border-eburon-border hover:bg-eburon-bg group"
                            >
                                <td onClick={() => setSelectedBooking(booking)} className="px-6 py-4 font-mono text-eburon-accent cursor-pointer">{booking.pnr}</td>
                                <td onClick={() => setSelectedBooking(booking)} className="px-6 py-4 font-semibold text-eburon-fg cursor-pointer">{booking.passenger_name}</td>
                                <td onClick={() => setSelectedBooking(booking)} className="px-6 py-4 cursor-pointer">{booking.flight_number} ({booking.origin} &rarr; {booking.destination})</td>
                                <td onClick={() => setSelectedBooking(booking)} className="px-6 py-4 cursor-pointer">{new Date(booking.flight_date).toLocaleDateString()}</td>
                                <td onClick={() => setSelectedBooking(booking)} className="px-6 py-4 cursor-pointer">
                                    <span className={`px-2 py-1 text-xs font-semibold rounded-full capitalize ${
                                        booking.status === 'confirmed' ? 'bg-blue-600 text-blue-100' :
                                        booking.status === 'checked_in' ? 'bg-green-600 text-green-100' :
                                        booking.status === 'completed' ? 'bg-gray-500 text-gray-100' :
                                        booking.status === 'canceled' ? 'bg-red-600 text-red-100' :
                                        'bg-yellow-600 text-yellow-100'
                                        }`}>{booking.status.replace('_', ' ')}</span>
                                </td>
                                <td className="px-6 py-4">
                                     <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button 
                                            onClick={() => handleOpenEditModal(booking)} 
                                            className="p-2 rounded-lg hover:bg-eburon-bg text-eburon-fg/70 hover:text-eburon-accent" 
                                            data-tooltip="Edit Booking"
                                        >
                                            <EditIcon className="w-4 h-4" />
                                        </button>
                                        <button 
                                            onClick={() => handleDeleteBooking(booking.pnr)} 
                                            className="p-2 rounded-lg hover:bg-eburon-bg text-eburon-fg/70 hover:text-red-400" 
                                            data-tooltip="Delete Booking"
                                        >
                                            <Trash2Icon className="w-4 h-4" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan={6} className="text-center py-8 text-eburon-fg/60">
                                    <DatabaseIcon className="w-12 h-12 mx-auto mb-2" />
                                    No bookings found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default CrmView;
