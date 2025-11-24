
import React from 'react';
import { CrmBooking } from '../types';
import { ChevronLeftIcon, UserIcon, MailIcon, PhoneIcon, CalendarIcon, CopyIcon, GlobeIcon } from './icons';

const DetailItem: React.FC<{ icon: React.FC<any>, label: string, value: string | React.ReactNode, isMono?: boolean, canCopy?: boolean }> = ({ icon: Icon, label, value, isMono = false, canCopy = false }) => {
    const [copied, setCopied] = React.useState(false);
    const handleCopy = () => {
        if (typeof value === 'string') {
            navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };
    return (
        <div className="bg-eburon-bg p-4 rounded-lg">
            <div className="text-sm text-eburon-fg/60 mb-1 flex items-center gap-2">
                <Icon className="w-4 h-4" />
                <span>{label}</span>
            </div>
            <div className="flex items-center justify-between">
                <p className={`text-eburon-fg font-semibold truncate ${isMono ? 'font-mono' : ''}`}>{value}</p>
                {canCopy && (
                    <button 
                        onClick={handleCopy} 
                        className="text-xs text-eburon-fg/70 hover:text-eburon-accent p-1"
                        data-tooltip={copied ? "Copied!" : "Copy to Clipboard"}
                    >
                        {copied ? 'Copied!' : <CopyIcon className="w-4 h-4" />}
                    </button>
                )}
            </div>
        </div>
    );
};

const CrmDetailView: React.FC<{ booking: CrmBooking; onBack: () => void }> = ({ booking, onBack }) => {

    const statusClasses = {
        confirmed: 'bg-blue-600 text-blue-100',
        checked_in: 'bg-green-600 text-green-100',
        completed: 'bg-gray-500 text-gray-100',
        canceled: 'bg-red-600 text-red-100',
        pending: 'bg-yellow-600 text-yellow-100',
    };
    const statusClass = statusClasses[booking.status] || 'bg-gray-600 text-gray-100';

    return (
        <div className="p-8 h-full overflow-y-auto">
            <div className="flex items-center gap-4 mb-6">
                <button onClick={onBack} className="flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-eburon-panel transition-colors -ml-3">
                    <ChevronLeftIcon className="w-5 h-5" />
                    <span className="font-semibold">Back to CRM</span>
                </button>
            </div>
            
            <div className="max-w-4xl mx-auto space-y-6">
                <header className="bg-eburon-panel border border-eburon-border rounded-xl p-6 flex flex-col sm:flex-row justify-between items-start gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-eburon-fg">{booking.passenger_name}</h1>
                        <p className="text-eburon-fg/70 font-mono">PNR: <span className="text-eburon-accent">{booking.pnr}</span></p>
                    </div>
                    <div className={`${statusClass} px-4 py-2 text-sm font-bold rounded-full capitalize`}>
                        {booking.status.replace('_', ' ')}
                    </div>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <DetailItem icon={UserIcon} label="Passenger" value={booking.passenger_name} />
                    <DetailItem icon={MailIcon} label="Email" value={booking.email} canCopy />
                    <DetailItem icon={PhoneIcon} label="Phone" value={booking.phone_number} canCopy />
                </div>

                <div className="bg-eburon-panel border border-eburon-border rounded-xl p-6">
                    <h2 className="text-xl font-semibold mb-4 text-eburon-fg">Flight Details</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                         <DetailItem icon={PhoneIcon} label="Flight Number" value={booking.flight_number} isMono />
                         <DetailItem icon={CalendarIcon} label="Flight Date" value={new Date(booking.flight_date).toLocaleString([], { dateStyle: 'long', timeStyle: 'short' })} />
                         <DetailItem icon={GlobeIcon} label="Route" value={`${booking.origin} ➔ ${booking.destination}`} />
                    </div>
                </div>

                 <div className="bg-eburon-panel border border-eburon-border rounded-xl p-6">
                    <h2 className="text-xl font-semibold mb-4 text-eburon-fg">Notes</h2>
                    {booking.notes && booking.notes.length > 0 ? (
                        <div className="space-y-3">
                            {booking.notes.map((note, index) => (
                                <div key={index} className="bg-eburon-bg p-3 rounded-lg">
                                    <p className="text-sm text-eburon-fg/90">"{note.text}"</p>
                                    <p className="text-xs text-eburon-fg/60 text-right mt-1">
                                        &mdash; {note.by} on {new Date(note.date).toLocaleDateString()}
                                    </p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-eburon-fg/60">No notes for this booking.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CrmDetailView;
