
import { CrmBooking } from '../types';
import { crmService } from './crmService';

// Utilities
const today = () => new Date().toISOString().slice(0,10);
const deepClone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const norm = (s?: string) => (s ?? '').toLowerCase().trim();
const digits = (s?: string) => (s ?? '').replace(/\D+/g, '');
const within = (iso: string, from?: string, to?: string) => {
  const t = new Date(iso).getTime();
  const f = from ? new Date(from).getTime() : -Infinity;
  const u = to ? new Date(to).getTime() : +Infinity;
  return t >= f && t <= u;
};

type Ok<T> = { ok: true; data: T };
type Err = { ok: false; error: string };

const ok = <T,>(data: T): Ok<T> => ({ ok: true, data });
const err = (error: string): Err => ({ ok: false, error });

export const CRM = {
  getByPnr(pnr: string, includeNotes?: boolean): Ok<CrmBooking | null> {
    const rec = crmService.getBookingByPnr(pnr);
    if (!rec) return ok<CrmBooking | null>(null);
    const out = deepClone(rec);
    if (!includeNotes) delete (out as any).notes;
    return ok(out);
  },

  search(filters: {
    passenger_name?: string; email?: string; phone_number?: string;
    flight_number?: string; origin?: string; destination?: string;
    flight_date_from?: string; flight_date_to?: string; status?: string; limit?: number;
  }): Ok<CrmBooking[]> {
    const {
      passenger_name, email, phone_number, flight_number,
      origin, destination, flight_date_from, flight_date_to,
      status = 'any', limit = 10,
    } = filters || {};
    
    const DB = crmService.getBookings();

    const res = DB.filter(b => {
      if (passenger_name && !norm(b.passenger_name).includes(norm(passenger_name))) return false;
      if (email && !norm(b.email).includes(norm(email))) return false;
      if (phone_number && !digits(b.phone_number).includes(digits(phone_number))) return false;
      if (flight_number && norm(b.flight_number) !== norm(flight_number)) return false;
      if (origin && !norm(b.origin).includes(norm(origin))) return false;
      if (destination && !norm(b.destination).includes(norm(destination))) return false;
      if ((flight_date_from || flight_date_to) && !within(b.flight_date, flight_date_from, flight_date_to)) return false;
      if (status && status !== 'any' && norm(b.status) !== norm(status)) return false;
      return true;
    })
    .sort((a, b) => new Date(b.flight_date).getTime() - new Date(a.flight_date).getTime())
    .slice(0, Math.max(0, Math.min(limit, 100)));

    return ok(deepClone(res));
  },

  create(payload: CrmBooking): Ok<CrmBooking> | Err {
    try {
      const newBooking = crmService.addBooking(payload);
      return ok(deepClone(newBooking));
    } catch (e: any) {
      return err(e.message);
    }
  },

  update(pnr: string, patch: Partial<CrmBooking> & { append_note?: { text: string; by: string; date?: string } }): Ok<CrmBooking> | Err {
     try {
      // First, apply direct updates
      let updatedBooking = crmService.updateBooking(pnr, patch);

      // Then, append note if provided
      if (patch.append_note?.text && patch.append_note.by) {
        updatedBooking = crmService.addNoteToBooking(pnr, { text: patch.append_note.text, by: patch.append_note.by, date: patch.append_note.date || today() });
      }
      return ok(deepClone(updatedBooking));
    } catch (e: any) {
      return err(e.message);
    }
  },

  updateStatus(pnr: string, status: CrmBooking['status'], comment?: string): Ok<CrmBooking> | Err {
    try {
      let booking = crmService.updateBooking(pnr, { status });
      if (comment) {
        booking = crmService.addNoteToBooking(pnr, { text: `Status changed to ${status}. ${comment}`, by: 'Ayla', date: today() });
      }
      return ok(deepClone(booking));
    } catch (e: any) {
      return err(e.message);
    }
  },

  addNote(pnr: string, note_text: string, created_by = 'Ayla'): Ok<CrmBooking> | Err {
    try {
      const booking = crmService.addNoteToBooking(pnr, { text: note_text, by: created_by, date: today() });
      return ok(deepClone(booking));
    } catch (e: any) {
      return err(e.message);
    }
  },

  delete(pnr: string, reason?: string): Ok<{ deleted: true; reason?: string }> | Err {
    try {
      crmService.deleteBooking(pnr);
      return ok({ deleted: true, reason });
    } catch(e: any) {
        return err(e.message);
    }
  },

  listRecent(limit = 10, status: CrmBooking['status'] | 'any' = 'any'): Ok<CrmBooking[]> {
    const DB = crmService.getBookings();
    const list = DB
      .filter(b => status === 'any' ? true : b.status === status)
      .sort((a, b) => new Date(b.flight_date).getTime() - new Date(a.flight_date).getTime())
      .slice(0, Math.max(0, Math.min(limit, 100)));
    return ok(deepClone(list));
  },
};

type ToolCall = { name: string; args?: any };

export const AYLA_TOOL_HANDLERS: Record<string, (args: any) => Ok<any> | Err> = {
  crm_get_booking_by_pnr: ({ pnr, include_notes }: { pnr: string; include_notes?: boolean }) =>
    CRM.getByPnr(pnr, include_notes),

  crm_search_bookings: (args: any) =>
    CRM.search(args || {}),

  crm_create_booking: (args: CrmBooking) =>
    CRM.create(args),

  crm_update_booking: (args: Partial<CrmBooking> & { pnr: string; append_note?: { text: string; by: string; date?: string } }) =>
    CRM.update(args.pnr, args),

  crm_delete_booking: ({ pnr, reason }: { pnr: string; reason?: string }) =>
    CRM.delete(pnr, reason),

  crm_update_booking_status: ({ pnr, status, comment }: { pnr: string; status: CrmBooking['status']; comment?: string }) =>
    CRM.updateStatus(pnr, status, comment),

  crm_add_booking_note: ({ pnr, note_text, created_by }: { pnr: string; note_text: string; created_by?: string }) =>
    CRM.addNote(pnr, note_text, created_by),
  
  crm_list_recent_bookings: ({ limit, status }: { limit?: number; status?: CrmBooking['status'] | 'any' }) =>
    CRM.listRecent(limit ?? 10, (status as any) ?? 'any'),
};

export function dispatchAylaToolCall(call: ToolCall): Ok<any> | Err {
  const fn = AYLA_TOOL_HANDLERS[call?.name];
  if (!fn) return err(`Unknown tool: ${call?.name}`);
  try {
    return fn(call.args || {});
  } catch (e: any) {
    return err(e?.message ?? 'Unhandled tool error');
  }
}
